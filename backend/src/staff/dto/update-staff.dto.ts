export class UpdateStaffDto {
  fullName?: string;
  email?: string;
  role?: string;
  // username and password are NOT updatable via this DTO
}
