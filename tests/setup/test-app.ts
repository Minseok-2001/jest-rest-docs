import express, { Request, Response, Router } from 'express';

interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserRequest extends Request {
  body: {
    name: string;
    email: string;
  };
}

interface GetUserRequest extends Request {
  params: {
    id: string;
  };
}

const app = express();
const router = Router();
app.use(express.json());

// 테스트용 메모리 DB
let users: User[] = [];
let nextId = 1;

// 사용자 생성 API
router.post('/api/users', (req: CreateUserRequest, res: Response) => {
  const newUser: User = {
    id: nextId++,
    name: req.body.name,
    email: req.body.email,
  };
  users.push(newUser);
  return res.status(201).json(newUser);
});

// 사용자 조회 API
router.get('/api/users/:id', (req: GetUserRequest, res: Response) => {
  const user = users.find((u) => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json(user);
});

app.use('/', router);

export default app;
