import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // ============================================================
  // Admin: NO seed data. Super Admin creates Admin accounts
  // via the API with invite tokens. This is intentional security.
  // ============================================================
  console.log('ℹ️  Admin accounts: Not seeded. Super Admin creates via API with invite tokens.');

  // ============================================================
  // Seed sample Doctor accounts (with temp password for first login)
  // ============================================================
  console.log('🌱 Seeding sample Doctor accounts...');

  const tempPassword = await bcrypt.hash('doctor123', 10);

  const doctor1User = await prisma.user.upsert({
    where: { username: 'dr.john.doe' },
    update: {},
    create: {
      username: 'dr.john.doe',
      email: 'john.doe@hospital.vn',
      password: tempPassword,
      role: 'DOCTOR',
      status: 'PENDING',
      firstLogin: true,
      registrationStep: 1,
    },
  });

  const doctor2User = await prisma.user.upsert({
    where: { username: 'dr.jane.smith' },
    update: {},
    create: {
      username: 'dr.jane.smith',
      email: 'jane.smith@hospital.vn',
      password: tempPassword,
      role: 'DOCTOR',
      status: 'PENDING',
      firstLogin: true,
      registrationStep: 1,
    },
  });

  const doctor3User = await prisma.user.upsert({
    where: { username: 'dr.alan.turing' },
    update: {},
    create: {
      username: 'dr.alan.turing',
      email: 'alan.turing@hospital.vn',
      password: tempPassword,
      role: 'DOCTOR',
      status: 'PENDING',
      firstLogin: true,
      registrationStep: 1,
    },
  });

  // Create DoctorProfiles
  const doc1Profile = await prisma.doctorProfile.upsert({
    where: { userId: doctor1User.id },
    update: {},
    create: {
      userId: doctor1User.id,
      doctorName: 'Dr. John Doe',
      licenseId: 'LIC-CARD-001',
      dateOfBirth: new Date('1980-05-15'),
      identityNumber: 'ID-001-VN',
      specialties: 'Cardiology',
      degree: 'MD, PhD',
      facultyOfWork: 'Heart Center',
      position: 'Senior Cardiologist',
      workingStartDate: new Date('2010-09-01'),
    },
  });

  const doc2Profile = await prisma.doctorProfile.upsert({
    where: { userId: doctor2User.id },
    update: {},
    create: {
      userId: doctor2User.id,
      doctorName: 'Dr. Jane Smith',
      licenseId: 'LIC-NEUR-002',
      dateOfBirth: new Date('1985-08-22'),
      identityNumber: 'ID-002-VN',
      specialties: 'Neurology',
      degree: 'MD',
      facultyOfWork: 'Neuroscience Department',
      position: 'Neurologist',
      workingStartDate: new Date('2015-03-01'),
    },
  });

  const doc3Profile = await prisma.doctorProfile.upsert({
    where: { userId: doctor3User.id },
    update: {},
    create: {
      userId: doctor3User.id,
      doctorName: 'Dr. Alan Turing',
      licenseId: 'LIC-GEN-003',
      dateOfBirth: new Date('1990-06-23'),
      identityNumber: 'ID-003-VN',
      specialties: 'General Practice',
      degree: 'MD',
      facultyOfWork: 'General Medicine',
      position: 'General Practitioner',
      workingStartDate: new Date('2018-07-01'),
    },
  });

  console.log(`  ✅ Created 3 Doctor accounts (temp password: doctor123)`);



  console.log('\n🌱 Seeding finished successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Summary:');
  console.log('   - Admins: None (create via Super Admin API)');
  console.log('   - Doctors: 3 (password: doctor123)');
  console.log('   - AI Models: Seeded manually or via API');
  console.log('   - Diagnoses: Seeded manually or via API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
