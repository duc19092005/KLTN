import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DoctorService } from './src/modules/doctor/services/doctor.service';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(DoctorService);
  try {
    const res = await service.createWithStaff({
      username: 'test_doctor_unique',
      email: 'test_doc@hospital.vn',
      fullName: 'Test Doctor',
      phone: '0987654321',
      gender: 'Nam',
      citizenId: '999999999999',
      birthDate: '1990-01-01',
      avatarUrl: 'https://avatar.url',
      specialty: 'Pediatrics',
      licenseNumber: 'VN-MOH-999999',
      qualification: 'MD',
      yearsExperience: 5,
      departmentId: '00000000-0000-0000-0000-000000000000'
    });
    console.log('Doctor created successfully:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Failed to create doctor:', err);
  } finally {
    await app.close();
  }
}
test();
