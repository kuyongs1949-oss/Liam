-- 초기 DB 설정 (Docker 자동 실행)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 보상금 기준 테이블
CREATE TABLE IF NOT EXISTS compensation_standards (
    id SERIAL PRIMARY KEY,
    noise_level VARCHAR(20) NOT NULL UNIQUE,
    range_description VARCHAR(50) NOT NULL,
    base_monthly INTEGER NOT NULL,
    coefficient DECIMAL(3,1) NOT NULL,
    description VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 기본 데이터 입력
INSERT INTO compensation_standards (noise_level, range_description, base_monthly, coefficient, description)
VALUES
    ('level1', '65~70dB', 300000, 0.5, '생활 방해 (경미)'),
    ('level2', '70~75dB', 600000, 1.0, '생활 방해 (보통)'),
    ('level3', '75~80dB', 1000000, 1.5, '생활 방해 (심각)'),
    ('level4', '80dB 이상', 1200000, 2.0, '생활 방해 (매우 심각)')
ON CONFLICT (noise_level) DO NOTHING;

-- 계산 세션 테이블
CREATE TABLE IF NOT EXISTS calculation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name VARCHAR(200),
    source_lat DECIMAL(10,7),
    source_lng DECIMAL(10,7),
    equipments JSONB,
    barrier_config JSONB,
    suffering_months DECIMAL(5,1),
    total_receptors INTEGER,
    exceeds_count INTEGER,
    total_compensation BIGINT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 수용자 보상금 결과 테이블
CREATE TABLE IF NOT EXISTS receptor_compensations (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES calculation_sessions(id) ON DELETE CASCADE,
    receptor_id VARCHAR(100),
    name VARCHAR(200),
    address TEXT,
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    floors INTEGER,
    households INTEGER,
    noise_db DECIMAL(6,2),
    noise_level VARCHAR(20),
    total_compensation BIGINT,
    per_household BIGINT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_sessions_created ON calculation_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receptors_session ON receptor_compensations(session_id);
CREATE INDEX IF NOT EXISTS idx_receptors_noise ON receptor_compensations(noise_db DESC);
