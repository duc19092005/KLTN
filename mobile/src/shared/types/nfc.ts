export type KLTNNfcCard = {
  type: 'KLTN_CCCD';
  version: 1;
  citizenId: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  address: string;
  issuedAt?: string;
};

export type ReceptionistPairingPayload = {
  type: 'KLTN_NFC_SESSION';
  version: 1;
  sessionId: string;
  mobileToken: string;
};

export type BlockchainVerification = {
  status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
  dbMatches: boolean;
  chainMatches: boolean;
  batchId: number | null;
  txHash: string | null;
  anchoredAt: string | null;
};

export type PatientVerificationResult = {
  patient: {
    patientCode: string;
    fullName: string;
    gender: string;
    birthDate: string | null;
  };
  patientIntegrity: {
    status: string;
    dbMatches: boolean;
    chainMatches: boolean;
  };
  totalVisits: number;
  visits: Array<{
    visitCode: string;
    checkInAt: string | null;
    completedAt: string | null;
    status: string;
    department: { name: string; departmentCode: string } | null;
    doctor: { fullName: string; employeeCode: string } | null;
    conclusion: {
      finalDiagnosis: string;
      treatmentPlan: string | null;
      prescription: string | null;
      followUpNote: string | null;
      doctorNote: string | null;
      concludedAt: string | null;
      hash256: string | null;
    } | null;
    blockchainVerification: BlockchainVerification | null;
  }>;
};

export type PatientNfcLoginResponse = {
  authMethod: 'NFC_CCCD';
  card: Pick<KLTNNfcCard, 'type' | 'version' | 'citizenId' | 'fullName'>;
  verification: PatientVerificationResult;
};
