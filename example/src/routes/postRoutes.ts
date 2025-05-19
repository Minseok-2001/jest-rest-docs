import express from 'express';
import * as postController from '../controllers/postController';

const router = express.Router();

// 모든 게시물 조회
router.get('/', postController.getPosts);

// 게시물 검색
router.get('/search', postController.searchPosts);

// 작성자별 게시물 조회
router.get('/author/:authorId', postController.getPostsByAuthor);

// 특정 게시물 조회
router.get('/:id', postController.getPostById);

// 게시물 생성
router.post('/', postController.createPost);

// 게시물 수정
router.put('/:id', postController.updatePost);

// 게시물 삭제
router.delete('/:id', postController.deletePost);

export default router;
