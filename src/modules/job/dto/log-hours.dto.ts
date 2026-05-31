import { IsNumber, IsPositive } from 'class-validator';

export class LogHoursDto {
  @IsNumber()
  @IsPositive()
  loggedHours: number;
}
