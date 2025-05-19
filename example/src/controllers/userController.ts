import { Request, Response, NextFunction } from 'express';
import { userModel, User } from '../models/userModel';
import { v4 as uuidv4 } from 'uuid';

export const getUsers = (req: Request, res: Response) => {
  const users = userModel.getAllUsers();
  res.status(200).json({ users });
};

export const getUserById = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const user = userModel.getUserById(id);

  if (!user) {
    const error: any = new Error('사용자를 찾을 수 없습니다');
    error.status = 404;
    return next(error);
  }

  res.status(200).json({ user });
};

export const createUser = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, name } = req.body;

    if (!username || !email || !name) {
      const error: any = new Error('필수 필드가 누락되었습니다');
      error.status = 400;
      return next(error);
    }

    const newUser: User = {
      id: uuidv4(),
      username,
      email,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdUser = userModel.addUser(newUser);
    res.status(201).json({ user: createdUser });
  } catch (error) {
    next(error);
  }
};

export const updateUser = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const updateData = req.body;

  const updatedUser = userModel.updateUser(id, updateData);

  if (!updatedUser) {
    const error: any = new Error('사용자를 찾을 수 없습니다');
    error.status = 404;
    return next(error);
  }

  res.status(200).json({ user: updatedUser });
};

export const deleteUser = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const deleted = userModel.deleteUser(id);

  if (!deleted) {
    const error: any = new Error('사용자를 찾을 수 없습니다');
    error.status = 404;
    return next(error);
  }

  res.status(204).send();
};

export const searchUsers = (req: Request, res: Response) => {
  const { name } = req.query;

  if (typeof name !== 'string') {
    res.status(200).json({ users: [] });
    return;
  }

  const users = userModel.findUsersByName(name);
  res.status(200).json({ users });
};
