export class CreateStaffDto {
  fullName: string;
  username: string; // must be unique
  password: string; // min 6 characters, will be bcrypt hashed before saving
  role: string; // ADMIN | STAFF_SALES | STAFF_WAREHOUSE | STAFF_WARRANTY
  email?: string;
}
