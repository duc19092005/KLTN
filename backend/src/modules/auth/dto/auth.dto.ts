import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEthereumAddress,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class BootstrapAdminDto {
  @IsOptional()
  @IsString()
  @Length(3, 64)
  username?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsString()
  @Length(16, 256)
  superAdminSecret: string;
}

export class InviteLoginDto {
  @IsString()
  @Length(32, 256)
  inviteToken: string;
}

export class FaceDescriptorDto {
  @IsArray()
  embedding: number[] | number[][];
}

export class WalletChallengeDto {
  @IsEthereumAddress()
  address: string;
}

export class WalletVerifyDto {
  @IsEthereumAddress()
  address: string;

  @IsString()
  @Length(64, 512)
  signature: string;

  @IsString()
  @Length(32, 2048)
  message: string;
}

export class WalletLoginDto {
  @IsEthereumAddress()
  walletAddress: string;

  @IsString()
  @Length(64, 512)
  signature: string;

  @IsString()
  @Length(32, 2048)
  message: string;
}

export class StaffLoginDto {
  @IsString()
  @Length(3, 128)
  username: string;

  @IsString()
  @Length(6, 256)
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(6, 256)
  currentPassword: string;

  @IsString()
  @Length(8, 256)
  newPassword: string;
}
