import { Request, Response, NextFunction } from 'express';
import { postModel, Post } from '../models/postModel';
import { v4 as uuidv4 } from 'uuid';

export const getPosts = (req: Request, res: Response) => {
  const posts = postModel.getAllPosts();
  res.status(200).json({ posts });
};

export const getPostById = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const post = postModel.getPostById(id);

  if (!post) {
    const error: any = new Error('게시물을 찾을 수 없습니다');
    error.status = 404;
    return next(error);
  }

  res.status(200).json({ post });
};

export const createPost = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, authorId } = req.body;

    if (!title || !content || !authorId) {
      const error: any = new Error('필수 필드가 누락되었습니다');
      error.status = 400;
      return next(error);
    }

    const newPost: Post = {
      id: uuidv4(),
      title,
      content,
      authorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdPost = postModel.addPost(newPost);
    res.status(201).json({ post: createdPost });
  } catch (error) {
    next(error);
  }
};

export const updatePost = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const updateData = req.body;

  const updatedPost = postModel.updatePost(id, updateData);

  if (!updatedPost) {
    const error: any = new Error('게시물을 찾을 수 없습니다');
    error.status = 404;
    return next(error);
  }

  res.status(200).json({ post: updatedPost });
};

export const deletePost = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const deleted = postModel.deletePost(id);

  if (!deleted) {
    const error: any = new Error('게시물을 찾을 수 없습니다');
    error.status = 404;
    return next(error);
  }

  res.status(204).send();
};

export const getPostsByAuthor = (req: Request, res: Response, next: NextFunction) => {
  const { authorId } = req.params;
  const posts = postModel.getPostsByAuthor(authorId);
  res.status(200).json({ posts });
};

export const searchPosts = (req: Request, res: Response) => {
  const { title } = req.query;

  if (typeof title !== 'string') {
    res.status(200).json({ posts: [] });
    return;
  }

  const posts = postModel.searchPostsByTitle(title);
  res.status(200).json({ posts });
};
