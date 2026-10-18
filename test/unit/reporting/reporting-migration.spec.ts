import { QueryRunner } from 'typeorm';
import { InitControlPlaneReporting1792336265207 } from '../../../src/reporting/infrastructure/persistence/migrations/1792336265207-InitControlPlaneReporting';

describe('InitControlPlaneReporting migration', () => {
  it('crée les tables reporting isolées et leurs contraintes d’unicité/fenêtre', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const runner = { query } as unknown as QueryRunner;
    await new InitControlPlaneReporting1792336265207().up(runner);
    const sql = query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('CREATE TABLE "reporting_audit_event"');
    expect(sql).toContain('CREATE TABLE "reporting_metric_snapshot"');
    expect(sql).toContain('"schema_version" varchar(8) NOT NULL');
    expect(sql).toContain('UNIQUE ("source_application_id", "source_instance_id", "environment", "event_id")');
    expect(sql).toContain('UNIQUE ("source_application_id", "source_instance_id", "environment", "snapshot_id")');
    expect(sql).toContain('interval \'1 day\'');
    expect(sql).not.toContain('CREATE TABLE "audit_evenement"');
  });

  it('supprime uniquement les tables reporting lors du down', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const runner = { query } as unknown as QueryRunner;
    await new InitControlPlaneReporting1792336265207().down(runner);
    expect(query.mock.calls.map(([statement]) => String(statement))).toEqual([
      'DROP TABLE IF EXISTS "reporting_metric_snapshot";',
      'DROP TABLE IF EXISTS "reporting_audit_event";',
    ]);
  });
});
