import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDepartmentDto, UpdateDepartmentDto } from './department.dto';

describe('Department DTO business rules', () => {
  const validDepartment = {
    departmentCode: 'PB-LAB',
    name: 'Xét nghiệm 1',
    floor: '2A',
    type: 'LABORATORY',
    canReceiveOrders: true,
  };

  it('requires department type', async () => {
    const dto = plainToInstance(CreateDepartmentDto, { ...validDepartment, type: undefined });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'type')).toBe(true);
  });

  it('requires canReceiveOrders instead of silently defaulting to false', async () => {
    const dto = plainToInstance(CreateDepartmentDto, { ...validDepartment, canReceiveOrders: undefined });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'canReceiveOrders')).toBe(true);
  });

  it('does not turn an omitted update field into false', () => {
    const dto = plainToInstance(UpdateDepartmentDto, {});
    expect(dto.canReceiveOrders).toBeUndefined();
  });
});
