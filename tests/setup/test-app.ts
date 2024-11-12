import express, { Request, Response, Router } from 'express';

// Interfaces
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  address?: {
    street: string;
    city: string;
  };
  status?: 'active' | 'deactivated' | 'verified';
  deactivatedAt?: Date;
  avatarUrl?: string;
}

interface CreateUserRequest extends Request {
  body: {
    name: string;
    email: string;
    age?: number;
    address?: {
      street: string;
      city: string;
    };
  };
}

interface UpdateUserRequest extends Request {
  params: { id: string };
  body: Partial<CreateUserRequest['body']>;
}

// Setup
const app = express();
const router = Router();
app.use(express.json());

// 테스트용 메모리 DB
let users: User[] = [];
let nextId = 1;
const adminCredentials = {
  email: 'admin@example.com',
  password: 'admin123',
  token: 'admin-token-123',
};

// Middlewares
const validateAdmin = (req: Request, res: Response, next: Function) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (token !== adminCredentials.token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Routes
// 관리자 로그인
router.post('/api/admin/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (email === adminCredentials.email && password === adminCredentials.password) {
    return res.json({ token: adminCredentials.token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// 사용자 생성
router.post('/api/users', (req: CreateUserRequest, res: Response) => {
  const { name, email, age, address } = req.body;

  // 필수 필드 검증
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  // 이메일 형식 검증
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // 중복 이메일 검증
  if (users.some((user) => user.email === email)) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  const newUser: User = {
    id: nextId++,
    name,
    email,
    age,
    address,
    status: 'active',
  };

  users.push(newUser);
  return res.status(201).json(newUser);
});

// 사용자 목록 조회 (페이지네이션)
router.get('/api/users', (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const sort = req.query.sort as string;

  let filteredUsers = [...users].filter((user) => user.status !== 'deactivated');

  // 정렬 처리
  if (sort) {
    const [field, order] = sort.split(':');
    filteredUsers.sort((a: any, b: any) => {
      return order === 'asc' ? (a[field] > b[field] ? 1 : -1) : a[field] < b[field] ? 1 : -1;
    });
  }

  const start = (page - 1) * limit;
  const paginatedUsers = filteredUsers.slice(start, start + limit);

  return res.json({
    users: paginatedUsers,
    pagination: {
      total: filteredUsers.length,
      pages: Math.ceil(filteredUsers.length / limit),
      current: page,
      limit,
    },
  });
});

// 사용자 검색
router.get('/api/users/search', (req: Request, res: Response) => {
  const { name, city, minAge, maxAge } = req.query;

  let searchResults = users.filter((user) => {
    let matches = true;
    if (name) matches = matches && user.name.includes(name as string);
    if (city) matches = matches && user.address?.city === city;
    if (minAge) matches = matches && (user.age || 0) >= Number(minAge);
    if (maxAge) matches = matches && (user.age || 0) <= Number(maxAge);
    return matches;
  });

  return res.json(searchResults);
});

// 특정 사용자 조회
router.get('/api/users/:id', (req: Request, res: Response) => {
  const user = users.find((u) => u.id === parseInt(req.params.id));
  if (!user || user.status === 'deactivated') {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json(user);
});

// 사용자 정보 부분 업데이트
router.patch('/api/users/:id', (req: UpdateUserRequest, res: Response) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];
  const updates = req.body;

  // 주소 필드 특별 처리 (기존 값 유지)
  if (updates.address) {
    updates.address = {
      ...user.address,
      ...updates.address,
    };
  }

  users[userIndex] = {
    ...user,
    ...updates,
  };

  return res.json(users[userIndex]);
});

// 관리자 전용 API
// 사용자 비활성화
router.post('/api/admin/users/:id/deactivate', validateAdmin, (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.status = 'deactivated';
  user.deactivatedAt = new Date();

  return res.json({
    status: 'deactivated',
    deactivatedAt: user.deactivatedAt,
  });
});

app.use('/', router);

export default app;
