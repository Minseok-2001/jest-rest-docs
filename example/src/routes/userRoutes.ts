import express from 'express';
import * as userController from '../controllers/userController';

const router = express.Router();

// 모든 사용자 조회
router.get('/', userController.getUsers);

// 사용자 검색
router.get('/search', userController.searchUsers);

// 특정 사용자 조회
router.get('/:id', userController.getUserById);

// 사용자 생성
router.post('/', userController.createUser);

// 사용자 수정
router.put('/:id', userController.updateUser);

// 사용자 삭제
router.delete('/:id', userController.deleteUser);

export default router;
