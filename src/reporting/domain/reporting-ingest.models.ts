import {
  ReportingAuditEventDto,
  ReportingMetricPointDto,
  ReportingSourceDto,
} from '../interface/http/dto/reporting.dto';

export interface ReportingSource {
  applicationId: string;
  instanceId: string;
  environment: 'development' | 'test' | 'staging' | 'production';
}

export interface ReportingAuditEvent {
  eventId: string;
  occurredAt: string;
  eventType: string;
  actorRef?: string;
  actorRoleClass?: string;
  organizationRef?: string;
  resourceType?: string;
  resourceRef?: string;
  action: string;
  outcome: 'success' | 'failure' | 'rejected';
  countryCode?: string;
  correlationId?: string;
}

export interface ReportingMetricPoint {
  name: string;
  kind: 'counter' | 'gauge' | 'histogram_summary';
  value: number;
  unit: string;
  dimensions: {
    routeGroup?: string;
    statusClass?: string;
    component?: string;
  };
}

export function reportingSourceFromDto(dto: ReportingSourceDto): ReportingSource {
  return {
    applicationId: dto.applicationId,
    instanceId: dto.instanceId,
    environment: dto.environment as ReportingSource['environment'],
  };
}

export function reportingAuditEventFromDto(dto: ReportingAuditEventDto): ReportingAuditEvent {
  return {
    eventId: dto.eventId,
    occurredAt: dto.occurredAt,
    eventType: dto.eventType,
    actorRef: dto.actorRef,
    actorRoleClass: dto.actorRoleClass,
    organizationRef: dto.organizationRef,
    resourceType: dto.resourceType,
    resourceRef: dto.resourceRef,
    action: dto.action,
    outcome: dto.outcome as ReportingAuditEvent['outcome'],
    countryCode: dto.countryCode,
    correlationId: dto.correlationId,
  };
}

export function reportingMetricPointFromDto(dto: ReportingMetricPointDto): ReportingMetricPoint {
  return {
    name: dto.name,
    kind: dto.kind as ReportingMetricPoint['kind'],
    value: dto.value,
    unit: dto.unit,
    dimensions: {
      routeGroup: dto.dimensions.routeGroup,
      statusClass: dto.dimensions.statusClass,
      component: dto.dimensions.component,
    },
  };
}
