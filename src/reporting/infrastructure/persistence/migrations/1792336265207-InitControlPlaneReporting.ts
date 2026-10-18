import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitControlPlaneReporting1792336265207 implements MigrationInterface {
  name = 'InitControlPlaneReporting1792336265207';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await queryRunner.query(`
      CREATE TABLE "reporting_audit_event" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "batch_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "schema_version" varchar(8) NOT NULL,
        "source_application_id" varchar(64) NOT NULL,
        "source_instance_id" varchar(96) NOT NULL,
        "environment" varchar(16) NOT NULL,
        "event_type" varchar(150) NOT NULL,
        "occurred_at" timestamptz NOT NULL,
        "actor_ref" varchar(138),
        "actor_role_class" varchar(64),
        "organization_ref" varchar(138),
        "resource_type" varchar(64),
        "resource_ref" varchar(138),
        "action" varchar(64) NOT NULL,
        "outcome" varchar(16) NOT NULL,
        "country_code" char(2),
        "correlation_id" uuid,
        "payload_hash" char(64) NOT NULL,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reporting_audit_event" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reporting_audit_source_event" UNIQUE ("source_application_id", "source_instance_id", "environment", "event_id"),
        CONSTRAINT "CHK_reporting_audit_environment" CHECK ("environment" IN ('development', 'test', 'staging', 'production')),
        CONSTRAINT "CHK_reporting_audit_outcome" CHECK ("outcome" IN ('success', 'failure', 'rejected'))
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_reporting_audit_source_time"
      ON "reporting_audit_event" ("source_application_id", "source_instance_id", "environment", "occurred_at" DESC);
    `);
    await queryRunner.query(`CREATE INDEX "IDX_reporting_audit_retention" ON "reporting_audit_event" ("received_at");`);

    await queryRunner.query(`
      CREATE TABLE "reporting_metric_snapshot" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "snapshot_id" uuid NOT NULL,
        "source_application_id" varchar(64) NOT NULL,
        "source_instance_id" varchar(96) NOT NULL,
        "environment" varchar(16) NOT NULL,
        "schema_version" varchar(8) NOT NULL,
        "window_start" timestamptz NOT NULL,
        "window_end" timestamptz NOT NULL,
        "payload_hash" char(64) NOT NULL,
        "metrics" jsonb NOT NULL,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reporting_metric_snapshot" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reporting_metric_source_snapshot" UNIQUE ("source_application_id", "source_instance_id", "environment", "snapshot_id"),
        CONSTRAINT "CHK_reporting_metric_environment" CHECK ("environment" IN ('development', 'test', 'staging', 'production')),
        CONSTRAINT "CHK_reporting_metric_window" CHECK ("window_end" > "window_start" AND "window_end" - "window_start" <= interval '1 day'),
        CONSTRAINT "CHK_reporting_metric_payload_array" CHECK (jsonb_typeof("metrics") = 'array' AND jsonb_array_length("metrics") BETWEEN 1 AND 100)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_reporting_metric_source_window"
      ON "reporting_metric_snapshot" ("source_application_id", "source_instance_id", "environment", "window_end" DESC);
    `);
    await queryRunner.query(`CREATE INDEX "IDX_reporting_metric_retention" ON "reporting_metric_snapshot" ("received_at");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reporting_metric_snapshot";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reporting_audit_event";`);
  }
}
