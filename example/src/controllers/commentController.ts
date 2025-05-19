import { Request, Response, NextFunction } from 'express';
import { commentModel, Comment } from '../models/commentModel';
import { v4 as uuidv4 } from 'uuid';

export const getComments = (req: Request, res: Response) => {
  const comments = commentModel.getAllComments();
  res.status(200).json({ comments });
};

export const getCommentById = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const comment = commentModel.getCommentById(id);

  if (!comment) {
    const error: any = new Error('댓글을 찾을 수 없습니다');
    error.status = 404;
    return next(error);
  }

  res.status(200).json({ comment });
};

export const createComment = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postId, authorId, content } = req.body;

    if (!postId || !authorId || !content) {
      const error: any = new Error('필수 필드가 누락되었습니다');
      error.status = 400;
      return next(error);
    }

    const newComment: Comment = {
      id: uuidv4(),
      postId,
      authorId,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdComment = commentModel.addComment(newComment);
    res.status(201).json({ comment: createdComment });
  } catch (error) {
    next(error);
  }
};

export const updateComment = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const updateData = req.body;

  const updatedComment = commentModel.updateComment(id, updateData);

  if (!updatedComment) {
    const error: any = new Error('댓글을 찾을 수 없습니다');
    error.status = 404;
    return next(error);
  }

  res.status(200).json({ comment: updatedComment });
};

export const deleteComment = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const deleted = commentModel.deleteComment(id);

  if (!deleted) {
    const error: any = new Error('댓글을 찾을 수 없습니다');
    error.status = 404;
    return next(error);
  }

  res.status(204).send();
};

export const getCommentsByPost = (req: Request, res: Response) => {
  const { postId } = req.params;
  const comments = commentModel.getCommentsByPost(postId);
  res.status(200).json({ comments });
};

export const getCommentsByAuthor = (req: Request, res: Response) => {
  const { authorId } = req.params;
  const comments = commentModel.getCommentsByAuthor(authorId);
  res.status(200).json({ comments });
};
