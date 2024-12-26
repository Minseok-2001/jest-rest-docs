import express, { Request, Response, Router } from 'express';

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

const app = express();
const router = Router();
app.use(express.json());

let users: User[] = [];
let nextId = 1;
const adminCredentials = {
  email: 'admin@example.com',
  password: 'admin123',
  token: 'admin-token-123',
};

const validateAdmin = (req: Request, res: Response, next: () => void) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (token !== adminCredentials.token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

router.post('/api/admin/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (email === adminCredentials.email && password === adminCredentials.password) {
    return res.json({ token: adminCredentials.token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

router.post('/api/users', (req: CreateUserRequest, res: Response) => {
  const { name, email, age, address } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email123 format' });
  }

  if (users.some((user) => user.email === email)) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  if (typeof name !== 'string') {
    return res.status(400).json({ error: 'Name must be a string' });
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

router.get('/api/users', (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const sort = req.query.sort as string;

  let filteredUsers = [...users].filter((user) => user.status !== 'deactivated');

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

router.get('/api/users/:id', (req: Request, res: Response) => {
  const user = users.find((u) => u.id === parseInt(req.params.id));
  if (!user || user.status === 'deactivated') {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json(user);
});

router.patch('/api/users/:id', (req: UpdateUserRequest, res: Response) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];
  const updates = req.body;

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
