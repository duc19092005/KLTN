import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { MapUploadedResultFilesUseCase } from './map-uploaded-result-files.use-case';

describe('MapUploadedResultFilesUseCase', () => {
  let useCase: MapUploadedResultFilesUseCase;
  let mockRepo: any;
  let mockStorage: any;

  beforeEach(() => {
    mockRepo = {
      findOrderForManage: jest.fn(),
    };
    mockStorage = {
      uploadResultFiles: jest.fn().mockResolvedValue([{ url: 'mocked-url' }]),
    };
    useCase = new MapUploadedResultFilesUseCase(mockRepo, mockStorage);
  });

  const pdfFile = {
    buffer: Buffer.from('pdf'),
    originalname: 'result.pdf',
    mimetype: 'application/pdf',
    size: 100,
  };

  const imageFile = {
    buffer: Buffer.from('image'),
    originalname: 'result.png',
    mimetype: 'image/png',
    size: 100,
  };

  it('should throw BadRequestException if files array is empty', async () => {
    await expect(useCase.execute('order-1', [])).rejects.toThrow(
      new BadRequestException('Vui lòng tải lên ít nhất một file PDF hoặc hình ảnh.'),
    );
  });

  it('should throw NotFoundException if order does not exist', async () => {
    mockRepo.findOrderForManage.mockResolvedValue(null);
    await expect(useCase.execute('order-1', [pdfFile])).rejects.toThrow(
      new NotFoundException('Không tìm thấy phiếu chỉ định.'),
    );
  });

  it('should throw BadRequestException if order status is RESULT_READY', async () => {
    mockRepo.findOrderForManage.mockResolvedValue({
      id: 'order-1',
      status: MedicalOrderStatus.RESULT_READY,
      orderType: 'LAB_TEST',
    });
    await expect(useCase.execute('order-1', [pdfFile])).rejects.toThrow(
      new BadRequestException('Không thể tải file cho phiếu đã sẵn sàng, hoàn tất hoặc đã hủy.'),
    );
  });

  it('should throw BadRequestException if order status is CANCELLED', async () => {
    mockRepo.findOrderForManage.mockResolvedValue({
      id: 'order-1',
      status: MedicalOrderStatus.CANCELLED,
      orderType: 'LAB_TEST',
    });
    await expect(useCase.execute('order-1', [pdfFile])).rejects.toThrow(
      new BadRequestException('Không thể tải file cho phiếu đã sẵn sàng, hoàn tất hoặc đã hủy.'),
    );
  });

  describe('LAB_TEST & MRI checks', () => {
    it.each([
      ['LAB_TEST'],
      ['Xét nghiệm máu tổng quát'],
      ['BLOOD_TEST'],
      ['MRI'],
      ['Chụp MRI'],
      ['CỘNG HƯỞNG TỪ'],
    ])('should allow both PDF and image for orderType: %s', async (orderType) => {
      mockRepo.findOrderForManage.mockResolvedValue({
        id: 'order-1',
        status: MedicalOrderStatus.ORDERED,
        orderType,
      });

      await expect(useCase.execute('order-1', [pdfFile, imageFile])).resolves.toEqual([{ url: 'mocked-url' }]);
      expect(mockStorage.uploadResultFiles).toHaveBeenCalledWith('order-1', [pdfFile, imageFile]);
    });
  });

  describe('XRAY, CT_SCAN & ULTRASOUND checks', () => {
    const orderTypes = [
      'XRAY',
      'Chụp X-quang phổi',
      'CT_SCAN',
      'Chụp cắt lớp vi tính',
      'ULTRASOUND',
      'Siêu âm ổ bụng',
    ];

    it.each(orderTypes)('should allow image for orderType: %s', async (orderType) => {
      mockRepo.findOrderForManage.mockResolvedValue({
        id: 'order-1',
        status: MedicalOrderStatus.ORDERED,
        orderType,
      });

      await expect(useCase.execute('order-1', [imageFile])).resolves.toEqual([{ url: 'mocked-url' }]);
    });

    it.each(orderTypes)('should block PDF for orderType: %s', async (orderType) => {
      mockRepo.findOrderForManage.mockResolvedValue({
        id: 'order-1',
        status: MedicalOrderStatus.ORDERED,
        orderType,
      });

      await expect(useCase.execute('order-1', [pdfFile])).rejects.toThrow(
        new BadRequestException('Chỉ chấp nhận file hình ảnh cho chỉ định này.'),
      );
    });
  });

  describe('PDF_REPORT & ECG checks', () => {
    const orderTypes = [
      'PDF_REPORT',
      'ECG',
      'Điện tâm đồ ECG',
      'Báo cáo kết quả',
    ];

    it.each(orderTypes)('should allow PDF for orderType: %s', async (orderType) => {
      mockRepo.findOrderForManage.mockResolvedValue({
        id: 'order-1',
        status: MedicalOrderStatus.ORDERED,
        orderType,
      });

      await expect(useCase.execute('order-1', [pdfFile])).resolves.toEqual([{ url: 'mocked-url' }]);
    });

    it.each(orderTypes)('should block image for orderType: %s', async (orderType) => {
      mockRepo.findOrderForManage.mockResolvedValue({
        id: 'order-1',
        status: MedicalOrderStatus.ORDERED,
        orderType,
      });

      await expect(useCase.execute('order-1', [imageFile])).rejects.toThrow(
        new BadRequestException('Chỉ chấp nhận file PDF cho chỉ định này.'),
      );
    });
  });

  describe('Fallback behavior', () => {
    it('should allow both PDF and image for unknown order types', async () => {
      mockRepo.findOrderForManage.mockResolvedValue({
        id: 'order-1',
        status: MedicalOrderStatus.ORDERED,
        orderType: 'UNKNOWN_TEST_TYPE',
      });

      await expect(useCase.execute('order-1', [pdfFile, imageFile])).resolves.toEqual([{ url: 'mocked-url' }]);
    });
  });
});
