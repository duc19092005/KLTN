import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { PaginationQueryDto } from '../../shared/pagination.dto';

const PATIENT_GENDER_VALUES = ['MALE', 'FEMALE'] as const;
const MIN_BIRTH_YEAR = 1900;
const VN_PHONE_REGEX = /^(0)(3[2-9]|5[2689]|7[06-9]|8[1-689]|9[0-46-9])\d{7}$/;
const VN_CITIZEN_ID_REGEX = /^\d{12}$/;
const VN_HEALTH_INSURANCE_REGEX = /^\d{10}$/;
const VIETNAMESE_NAME_REGEX = /^[A-Za-zÀ-ỹ\s]+$/;

function IsValidBirthDateRange(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidBirthDateRange',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const [yearText, monthText, dayText] = value.slice(0, 10).split('-');
          const year = Number(yearText);
          const month = Number(monthText);
          const day = Number(dayText);
          if (!year || !month || !day || year < MIN_BIRTH_YEAR) return false;
          const birthDate = new Date(year, month - 1, day);
          if (
            birthDate.getFullYear() !== year ||
            birthDate.getMonth() !== month - 1 ||
            birthDate.getDate() !== day
          ) {
            return false;
          }
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return birthDate <= today;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} phải từ năm ${MIN_BIRTH_YEAR} và không lớn hơn ngày hiện tại.`;
        },
      },
    });
  };
}

function HasAtLeastOneContactMethod(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'hasAtLeastOneContactMethod',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const dto = args.object as {
            phone?: string;
            citizenId?: string;
            insuranceNumber?: string;
            emergencyContact?: string;
          };
          return [dto.phone, dto.citizenId, dto.insuranceNumber, dto.emergencyContact].some(
            (value) => typeof value === 'string' && value.trim().length > 0,
          );
        },
        defaultMessage() {
          return 'Hồ sơ bệnh nhân phải có ít nhất một thông tin liên hệ hoặc định danh hợp lệ (SĐT, CCCD, BHYT hoặc liên hệ khẩn cấp).';
        },
      },
    });
  };
}

export class CreatePatientDto {
  @ApiPropertyOptional({ example: 'BN-0001' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  patientCode?: string;

  @ApiProperty({ example: 'Nguyễn Văn A', maxLength: 80 })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên.' })
  @MaxLength(80, { message: 'Họ tên không được vượt quá 80 ký tự.' })
  @Matches(VIETNAMESE_NAME_REGEX, { message: 'Họ tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng.' })
  @HasAtLeastOneContactMethod({
    message:
      'Hồ sơ bệnh nhân phải có ít nhất một thông tin liên hệ hoặc định danh hợp lệ (SĐT, CCCD, BHYT hoặc liên hệ khẩn cấp).',
  })
  fullName!: string;

  @ApiProperty({ example: 'MALE', enum: PATIENT_GENDER_VALUES })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn giới tính.' })
  @IsIn(PATIENT_GENDER_VALUES, { message: 'Giới tính chỉ được chọn Nam hoặc Nữ.' })
  gender!: string;

  @ApiProperty({ example: '1990-01-01', description: 'ISO date generated from dd/mm/yyyy UI input' })
  @IsDateString({}, { message: 'Ngày sinh phải đúng định dạng ngày hợp lệ.' })
  @IsValidBirthDateRange({ message: `Ngày sinh phải từ năm ${MIN_BIRTH_YEAR} và không lớn hơn ngày hiện tại.` })
  birthDate!: string;

  @ApiPropertyOptional({ example: '012345678901' })
  @IsOptional()
  @IsString()
  @Matches(VN_CITIZEN_ID_REGEX, { message: 'CCCD phải gồm đúng 12 chữ số.' })
  citizenId?: string;

  @ApiPropertyOptional({ example: '0909123456' })
  @IsOptional()
  @IsString()
  @Matches(VN_PHONE_REGEX, { message: 'Số điện thoại Việt Nam phải gồm 10 số và đúng đầu số.' })
  phone?: string;

  @ApiProperty({ example: '123 Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh', maxLength: 255 })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ.' })
  @MaxLength(255, { message: 'Địa chỉ không được vượt quá 255 ký tự.' })
  address!: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  @Matches(VN_HEALTH_INSURANCE_REGEX, { message: 'Số BHYT phải gồm đúng 10 chữ số.' })
  insuranceNumber?: string;

  @ApiPropertyOptional({ example: '0909123456' })
  @IsOptional()
  @IsString()
  @Matches(VN_PHONE_REGEX, { message: 'Liên hệ khẩn cấp phải là số điện thoại Việt Nam gồm 10 số và đúng đầu số.' })
  emergencyContact?: string;
}

export class UpdatePatientDto extends CreatePatientDto {}

export class PatientQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  citizenId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}
