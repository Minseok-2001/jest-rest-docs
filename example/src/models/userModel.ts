export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// 인메모리 데이터베이스로 사용자 데이터 저장
class UserModel {
  private users: Map<string, User> = new Map();

  constructor() {
    // 몇 가지 샘플 사용자 추가
    this.addUser({
      id: '1',
      username: 'user1',
      email: 'user1@example.com',
      name: '사용자1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.addUser({
      id: '2',
      username: 'user2',
      email: 'user2@example.com',
      name: '사용자2',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 모든 사용자 가져오기
  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  // ID로 사용자 찾기
  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  // 사용자 추가
  addUser(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  // 사용자 수정
  updateUser(id: string, userData: Partial<User>): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = {
      ...user,
      ...userData,
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // 사용자 삭제
  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }

  // 사용자 이름으로 검색
  findUsersByName(name: string): User[] {
    return this.getAllUsers().filter((user) =>
      user.name.toLowerCase().includes(name.toLowerCase())
    );
  }
}

export const userModel = new UserModel();
