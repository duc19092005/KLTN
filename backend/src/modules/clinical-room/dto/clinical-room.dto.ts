import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperationalStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../shared/pagination.dto';

export class CreateClinicalRoomDto {
  @ApiProperty({ example: 'PK-101' })
  @IsString()
  @MaxLength(32)
  roomCode!: string;

  @ApiProperty({ example: 'Cardiology Room 101' })
  @IsString()
  @MaxLength(160)
  roomName!: string;

  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7' })
  @IsOptional()
  @IsString()
  @IsUUID()
  doctorId?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  floor?: string;

  @ApiPropertyOptional({ example: 'Outpatient consultation room' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: OperationalStatus, example: OperationalStatus.ACTIVE })
  @IsOptional()
  @IsEnum(OperationalStatus)
  status?: OperationalStatus;
}

export class UpdateClinicalRoomDto {
  @ApiPropertyOptional({ example: 'PK-101' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  roomCode?: string;

  @ApiPropertyOptional({ example: 'Cardiology Room 101' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  roomName?: string;

  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7', nullable: true })
  @IsOptional()
  @IsString()
  @IsUUID()
  doctorId?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  floor?: string;

  @ApiPropertyOptional({ example: 'Updated room description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: OperationalStatus, example: OperationalStatus.ACTIVE })
  @IsOptional()
  @IsEnum(OperationalStatus)
  status?: OperationalStatus;
}

export class AssignRoomDoctorDto {
  @ApiPropertyOptional({ example: '0d82b56f-5d0a-4501-bd18-bb9af91e90d7', nullable: true })
  @IsOptional()
  @IsString()
  @IsUUID()
  doctorId?: string;
}

export class ClinicalRoomQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'PK-101' })
  @IsOptional()
  @IsString()
  roomCode?: string;

  @ApiPropertyOptional({ example: 'Cardiology' })
  @IsOptional()
  @IsString()
  roomName?: string;

  @ApiPropertyOptional({ enum: OperationalStatus, example: OperationalStatus.ACTIVE })
  @IsOptional()
  @IsEnum(OperationalStatus)
  status?: OperationalStatus;
}
