import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '0909123456' })
  @IsString()
  @MaxLength(20)
  @Matches(/^(\+84|84|0)(3|5|7|8|9)\d{8}$/, { message: 'Số điện thoại không đúng định dạng Việt Nam.' })
  phone!: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'OTP phải gồm 6 chữ số.' })
  otp!: string;

  @ApiProperty({ example: 'Patient@12345', required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword?: string;
}

export class PatientPasswordLoginDto extends RequestOtpDto {
  @ApiProperty({ example: 'Patient@12345' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

export class PatientChangePasswordDto {
  @ApiProperty({ example: 'Patient@12345' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ example: 'NewPatient@12345' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
