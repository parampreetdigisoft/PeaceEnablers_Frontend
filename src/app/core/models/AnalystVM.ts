
export interface RegisterDto {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: number;
}

export interface InviteUserDto extends RegisterDto {
  invitedUserID: number;
  countryID: number[]; 
}

export interface UpdateInviteUserDto extends InviteUserDto {
  userID: number;
}
export interface InviteBulkUserDto {
  users: InviteUserDto[];
}
export interface SendRequestMailToUpdateCountry {
    userID: number;
    mailToUserID: number;
    userCountryMappingID: number;
}
