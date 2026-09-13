-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "RoomKind" AS ENUM ('LIVING_ROOM', 'KITCHEN', 'BEDROOM', 'BATHROOM', 'OFFICE', 'HALLWAY', 'GARAGE', 'UTILITY', 'GARDEN', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviceCategory" AS ENUM ('CAMERA', 'LOCK', 'CONTACT_SENSOR', 'MOTION_SENSOR', 'ENV_SENSOR', 'SIREN', 'HUB');

-- CreateEnum
CREATE TYPE "Capability" AS ENUM ('LOCK', 'CONTACT', 'MOTION', 'VIDEO', 'AUDIO', 'BATTERY', 'TEMPERATURE', 'HUMIDITY', 'SMOKE');

-- CreateEnum
CREATE TYPE "Connectivity" AS ENUM ('ONLINE', 'STALE', 'OFFLINE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DoorState" AS ENUM ('OPEN', 'CLOSED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LockState" AS ENUM ('LOCKED', 'UNLOCKED', 'JAMMED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MotionState" AS ENUM ('ACTIVE', 'INACTIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CameraState" AS ENUM ('ONLINE', 'OFFLINE', 'RECORDING');

-- CreateEnum
CREATE TYPE "SecurityMode" AS ENUM ('DISARMED', 'HOME', 'NIGHT', 'AWAY');

-- CreateEnum
CREATE TYPE "SecurityMachineState" AS ENUM ('IDLE_DISARMED', 'EXIT_DELAY', 'ARMED', 'ENTRY_DELAY', 'ALERT', 'ALARM', 'DISARMING');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('DEVICE', 'USER', 'AUTOMATION', 'SIMULATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('IDLE', 'RUNNING', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RoomKind" NOT NULL,
    "polygon" JSONB NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doors" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "adjoiningRoomId" TEXT,
    "wallOffset" JSONB NOT NULL,
    "isExterior" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT,

    CONSTRAINT "doors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "windows" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "wallOffset" JSONB NOT NULL,
    "deviceId" TEXT,

    CONSTRAINT "windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT,
    "category" "DeviceCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "connectivity" "Connectivity" NOT NULL DEFAULT 'UNKNOWN',
    "lastSeenAt" TIMESTAMP(3),
    "offlineThresholdSec" INTEGER NOT NULL DEFAULT 300,
    "doorState" "DoorState",
    "lockState" "LockState",
    "motionState" "MotionState",
    "cameraState" "CameraState",
    "batteryPct" INTEGER,
    "tempC" DOUBLE PRECISION,
    "humidityPct" DOUBLE PRECISION,
    "stateUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_capabilities" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "capability" "Capability" NOT NULL,

    CONSTRAINT "device_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_states" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "mode" "SecurityMode" NOT NULL DEFAULT 'DISARMED',
    "machineState" "SecurityMachineState" NOT NULL DEFAULT 'IDLE_DISARMED',
    "armedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_zones" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "security_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_rooms" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,

    CONSTRAINT "zone_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_devices" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,

    CONSTRAINT "zone_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_mode_activations" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "mode" "SecurityMode" NOT NULL,

    CONSTRAINT "zone_mode_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "deviceId" TEXT,
    "roomId" TEXT,
    "entityId" TEXT,
    "type" TEXT NOT NULL,
    "source" "EventSource" NOT NULL,
    "sequence" BIGINT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "triggerEventId" TEXT,
    "deviceId" TEXT,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_scenarios" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "script" JSONB NOT NULL,

    CONSTRAINT "simulation_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_runs" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'IDLE',
    "speedFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "simClockMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),

    CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshots" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "state" JSONB NOT NULL,

    CONSTRAINT "snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_propertyId_key" ON "memberships"("userId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "floors_propertyId_level_key" ON "floors"("propertyId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "doors_deviceId_key" ON "doors"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "windows_deviceId_key" ON "windows"("deviceId");

-- CreateIndex
CREATE INDEX "devices_propertyId_idx" ON "devices"("propertyId");

-- CreateIndex
CREATE INDEX "devices_roomId_idx" ON "devices"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "device_capabilities_deviceId_capability_key" ON "device_capabilities"("deviceId", "capability");

-- CreateIndex
CREATE UNIQUE INDEX "security_states_propertyId_key" ON "security_states"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "security_zones_propertyId_name_key" ON "security_zones"("propertyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "zone_rooms_zoneId_roomId_key" ON "zone_rooms"("zoneId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "zone_devices_zoneId_deviceId_key" ON "zone_devices"("zoneId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "zone_mode_activations_zoneId_mode_key" ON "zone_mode_activations"("zoneId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "events_eventId_key" ON "events"("eventId");

-- CreateIndex
CREATE INDEX "events_propertyId_occurredAt_idx" ON "events"("propertyId", "occurredAt");

-- CreateIndex
CREATE INDEX "events_propertyId_type_idx" ON "events"("propertyId", "type");

-- CreateIndex
CREATE INDEX "events_deviceId_occurredAt_idx" ON "events"("deviceId", "occurredAt");

-- CreateIndex
CREATE INDEX "alerts_propertyId_status_idx" ON "alerts"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_scenarios_key_key" ON "simulation_scenarios"("key");

-- CreateIndex
CREATE INDEX "snapshots_propertyId_takenAt_idx" ON "snapshots"("propertyId", "takenAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doors" ADD CONSTRAINT "doors_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doors" ADD CONSTRAINT "doors_adjoiningRoomId_fkey" FOREIGN KEY ("adjoiningRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doors" ADD CONSTRAINT "doors_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "windows" ADD CONSTRAINT "windows_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "windows" ADD CONSTRAINT "windows_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_capabilities" ADD CONSTRAINT "device_capabilities_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_states" ADD CONSTRAINT "security_states_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_zones" ADD CONSTRAINT "security_zones_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_rooms" ADD CONSTRAINT "zone_rooms_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "security_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_rooms" ADD CONSTRAINT "zone_rooms_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_devices" ADD CONSTRAINT "zone_devices_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "security_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_devices" ADD CONSTRAINT "zone_devices_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_mode_activations" ADD CONSTRAINT "zone_mode_activations_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "security_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "simulation_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
