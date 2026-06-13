"""
FastAPI 메인 서버
소음 계산 및 보상금 산출 API
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

import redis
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .noiseCalculator import NoiseCalculator, Equipment, BarrierSpec, get_equipment_list
from .compensationCalculator import CompensationCalculator
from .multiReceptorCalculator import MultiReceptorCalculator
from .mapVisualizer import MapVisualizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Redis 연결 (캐싱)
redis_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        redis_client = redis.from_url(redis_url, decode_responses=True)
        redis_client.ping()
        logger.info("✅ Redis 연결 성공")
    except Exception as e:
        logger.warning(f"⚠️ Redis 연결 실패 (캐싱 비활성화): {e}")
        redis_client = None
    yield


app = FastAPI(
    title="Noise Assessment Calculator API",
    description="건설현장 소음영향 평가 및 환경부 보상금 산출 시스템",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Request / Response 모델
# ──────────────────────────────────────────────

class EquipmentInput(BaseModel):
    equipment_id: str = Field(..., example="excavator")
    count: int = Field(1, ge=1, le=50)


class BarrierInput(BaseModel):
    height: float = Field(..., ge=0, le=20, description="방음벽 높이 (m)")
    material_loss: float = Field(10.0, ge=0, le=30, description="재료 감쇠 (dB)")
    d1: float = Field(..., ge=1, description="소음원→방음벽 거리 (m)")
    d2: float = Field(..., ge=1, description="방음벽→수음점 거리 (m)")
    source_height: float = Field(1.5, ge=0.5, le=10)
    receiver_height: float = Field(1.5, ge=0.5, le=10)


class QuickCalcRequest(BaseModel):
    equipments: list[EquipmentInput] = Field(..., min_length=1)
    d1: float = Field(..., ge=1, description="소음원→방음벽 거리 (m)")
    barrier_height: float = Field(0.0, ge=0, le=20)
    barrier_material_loss: float = Field(10.0, ge=0, le=30)
    d2: float = Field(..., ge=1, description="방음벽→수음점 거리 (m)")


class ReceptorInput(BaseModel):
    receptor_id: str
    name: str
    address: str
    lat: float
    lng: float
    floors: int = Field(1, ge=1, le=100)
    households: int = Field(1, ge=1)


class MultiCalcRequest(BaseModel):
    equipments: list[EquipmentInput]
    source_lat: float
    source_lng: float
    receptors: list[ReceptorInput]
    barrier: Optional[BarrierInput] = None
    suffering_months: float = Field(3.0, ge=0.5, le=120)
    ground_factor: float = Field(0.5, ge=0, le=1)
    filter_65db: bool = True


# ──────────────────────────────────────────────
# API 엔드포인트
# ──────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "redis": redis_client is not None}


@app.get("/equipments")
async def list_equipments():
    """등록된 장비 목록 반환"""
    return {"equipments": get_equipment_list()}


@app.get("/compensation/standards")
async def compensation_standards():
    """환경부 보상금 기준표 반환"""
    return {"standards": CompensationCalculator.get_standards_table()}


@app.post("/calculate/quick")
async def quick_calculate(req: QuickCalcRequest):
    """
    간편 계산 (소음원→방음벽→수음점 단일 경로)
    """
    try:
        # 장비 합산
        equipment_objs = [
            Equipment(equipment_id=eq.equipment_id, count=eq.count)
            for eq in req.equipments
        ]
        lw_total = NoiseCalculator.combine_equipment(equipment_objs)

        # 간편 계산
        result = NoiseCalculator.quick_calculate(
            lw_total=lw_total,
            d1=req.d1,
            barrier_height=req.barrier_height,
            d2=req.d2,
            barrier_material_loss=req.barrier_material_loss,
        )

        # 보상금 미리보기 (1세대, 3개월 기준)
        from .compensationCalculator import ReceptorInfo
        receptor = ReceptorInfo(
            receptor_id="preview",
            name="미리보기",
            address="-",
            lat=0, lng=0,
            noise_db=result["L_receiver"],
        )
        comp = CompensationCalculator.calculate_per_receptor(receptor, 3.0)

        return {
            "equipments": [
                {
                    "id": eq.equipment_id,
                    "name": eq.name,
                    "count": eq.count,
                    "lw": round(eq.combined_lw, 1),
                }
                for eq in equipment_objs
            ],
            "lw_total": round(lw_total, 1),
            "noise_result": result,
            "compensation_preview": {
                "noise_level": comp.noise_level.value,
                "description": comp.level_description,
                "per_household_3months": comp.per_household_compensation,
                "color": CompensationCalculator.get_noise_color(result["L_receiver"]),
            },
        }

    except KeyError as e:
        raise HTTPException(400, f"알 수 없는 장비 ID: {e}")
    except Exception as e:
        logger.error(f"Quick calculate error: {e}")
        raise HTTPException(500, str(e))


@app.post("/calculate/multi")
async def multi_calculate(req: MultiCalcRequest):
    """
    다중 수용자 병렬 계산 (8 workers)
    """
    try:
        calculator = MultiReceptorCalculator(workers=8)

        barrier_config = None
        if req.barrier:
            barrier_config = req.barrier.model_dump()

        result = calculator.calculate_all(
            equipments=[eq.model_dump() for eq in req.equipments],
            source_lat=req.source_lat,
            source_lng=req.source_lng,
            receptors=[r.model_dump() for r in req.receptors],
            barrier_config=barrier_config,
            suffering_months=req.suffering_months,
            ground_factor=req.ground_factor,
            filter_65db=req.filter_65db,
        )

        # GeoJSON 생성
        geojson = MapVisualizer.results_to_geojson(
            results=result["results"],
            source_lat=req.source_lat,
            source_lng=req.source_lng,
        )

        result["geojson"] = geojson
        return result

    except Exception as e:
        logger.error(f"Multi calculate error: {e}")
        raise HTTPException(500, str(e))


@app.post("/calculate/contours")
async def generate_contours(
    source_lat: float,
    source_lng: float,
    equipments: list[EquipmentInput],
):
    """소음 등치선 GeoJSON 생성"""
    try:
        equipment_objs = [
            Equipment(equipment_id=eq.equipment_id, count=eq.count)
            for eq in equipments
        ]
        lw_total = NoiseCalculator.combine_equipment(equipment_objs)

        contours = MapVisualizer.create_noise_contours(
            source_lat=source_lat,
            source_lng=source_lng,
            lw_total=lw_total,
        )
        return contours
    except Exception as e:
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
