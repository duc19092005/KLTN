import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ZkpService } from './zkp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FaceService } from '../face/face.service';
import { UserService } from '../user/user.service';
import { BlockchainService } from '../blockchain/blockchain.service';
@Controller('zkp')
export class ZkpController {
  constructor(
    private zkpService: ZkpService,
    private faceService: FaceService,
    private userService: UserService,
    private blockchainService: BlockchainService,
  ) {}

  /**
   * Register ZKP identity (called after face registration)
   * Reads faceHash from AdminProfile (for Admin) or DoctorProfile (for Doctor)
   */
  @UseGuards(JwtAuthGuard)
  @Post('register')
  async registerIdentity(@Request() req) {
    const user = await this.userService.findById(req.user.sub);

    // Get faceHash based on role
    let faceHash: string | null = null;
    if (user.adminProfile?.faceHash) {
      faceHash = user.adminProfile.faceHash;
    }

    if (!faceHash) {
      return { error: 'Please register your face first' };
    }
    return this.zkpService.registerIdentity(req.user.sub, faceHash);
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete')
  async completeRegistration(@Request() req) {
    await this.zkpService.completeRegistration(req.user.sub);
    return { message: 'Registration marked as complete' };
  }

  /**
   * Get recovery data (commitment + faceHash) for proof generation
   */
  @UseGuards(JwtAuthGuard)
  @Get('recovery-data')
  async getRecoveryData(@Request() req) {
    const data = await this.zkpService.getRecoveryData(req.user.sub);
    if (!data) {
      return { error: 'No ZKP identity found' };
    }
    return data;
  }

  /**
   * Update wallet address after successful on-chain recovery
   */
  @UseGuards(JwtAuthGuard)
  @Post('update-wallet')
  async updateWallet(@Request() req, @Body() body: { newAddress: string }) {
    await this.userService.updateWalletAddress(req.user.sub, body.newAddress);
    return { message: 'Wallet address updated in database' };
  }
  @UseGuards(JwtAuthGuard)
  @Post('register-onchain')
  async registerOnChain(@Body() body: { commitment: string; address: string }) {
    return this.blockchainService.registerOnChain(body.commitment, body.address);
  }
}
