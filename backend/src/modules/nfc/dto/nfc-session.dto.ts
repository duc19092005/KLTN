import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { NfcCardPayloadDto } from './nfc-card-payload.dto';

export class SubmitReceptionistNfcResultDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => NfcCardPayloadDto)
  card!: NfcCardPayloadDto;

  @ApiProperty({ example: 'mobile-token-from-session-qr' })
  @IsString()
  @MaxLength(128)
  mobileToken!: string;

  @ApiPropertyOptional({ example: 'Pixel 8 - Desk 01' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  scannerDeviceLabel?: string;
}

export class PatientNfcLoginDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => NfcCardPayloadDto)
  card!: NfcCardPayloadDto;
}
