export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type UserFormValues = {
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
};

export const emptyUserForm: UserFormValues = {
  name: '',
  email: '',
  password: '',
  role: 'user',
  status: 'active',
};
