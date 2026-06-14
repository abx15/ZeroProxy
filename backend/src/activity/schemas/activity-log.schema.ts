import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ActivityLogDocument = ActivityLog & Document;

export enum ActivityAction {
  // Auth actions
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',

  // Attendance actions
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',

  // User actions
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',

  // Session actions
  SESSION_FORCE_LOGOUT = 'SESSION_FORCE_LOGOUT',
  ALL_SESSIONS_FORCE_LOGOUT = 'ALL_SESSIONS_FORCE_LOGOUT',

  // System actions
  SESSIONS_CLEANUP = 'SESSIONS_CLEANUP',
}

@Schema({ timestamps: true, collection: 'activity_logs' })
export class ActivityLog {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  companyId: string;

  @Prop({ required: true })
  userEmail: string;

  @Prop({ required: true })
  userName: string;

  @Prop({ required: true, enum: ActivityAction })
  action: ActivityAction;

  @Prop({ default: 'SUCCESS', enum: ['SUCCESS', 'FAILED'] })
  status: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: '0.0.0.0' })
  ipAddress: string;

  @Prop({ default: 'Unknown' })
  deviceInfo: string;

  @Prop()
  targetUserId?: string;

  @Prop()
  targetUserEmail?: string;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

// Index for fast queries
ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ companyId: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1 });
ActivityLogSchema.index({ createdAt: -1 });
