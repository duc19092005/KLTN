import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class NfcCardPayloadDto {
  @ApiProperty({ example: 'KLTN_CCCD' })
  @IsString()
  @IsIn(['KLTN_CCCD'])
  type!: 'KLTN_CCCD';

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(1)
  version!: 1;

  @ApiProperty({ example: '079203000001' })
  @IsString()
  @MaxLength(32)
  citizenId!: string;

  @ApiProperty({ example: 'Nguyen Van An' })
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: '2003-04-12' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ example: 'MALE' })
  @IsString()
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender!: 'MALE' | 'FEMALE' | 'OTHER';

  @ApiProperty({ example: 'Ho Chi Minh City' })
  @IsString()
  @MaxLength(255)
  address!: string;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;
}
