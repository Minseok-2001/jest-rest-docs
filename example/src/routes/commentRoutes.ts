import express from 'express';
import * as commentController from '../controllers/commentController';

const router = express.Router();

// 모든 댓글 조회
router.get('/', commentController.getComments);

// 게시물별 댓글 조회
router.get('/post/:postId', commentController.getCommentsByPost);

// 작성자별 댓글 조회
router.get('/author/:authorId', commentController.getCommentsByAuthor);

// 특정 댓글 조회
router.get('/:id', commentController.getCommentById);

// 댓글 생성
router.post('/', commentController.createComment);

// 댓글 수정
router.put('/:id', commentController.updateComment);

// 댓글 삭제
router.delete('/:id', commentController.deleteComment);

export default router;
