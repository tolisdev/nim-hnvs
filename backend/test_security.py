# -*- coding: utf-8 -*-
"""Automated Security Test Suite for malakasiotis-video-sync"""
import unittest
import json
import io
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import app, ACTIVE_SESSIONS, is_token_valid

class SecurityTestSuite(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        ACTIVE_SESSIONS.clear()

    def test_01_security_headers_present(self):
        """Verify standard security headers are injected in responses"""
        res = self.client.get('/api/lessons')
        self.assertEqual(res.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(res.headers.get('X-Frame-Options'), 'SAMEORIGIN')
        self.assertEqual(res.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')

    def test_02_unauthenticated_post_lessons_rejected(self):
        """Verify POST /api/lessons requires admin authentication (HTTP 401)"""
        res = self.client.post('/api/lessons', data={'number': '999', 'title': 'Test'})
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertIn('Unauthorized', data.get('error', ''))

    def test_03_unauthenticated_put_lessons_rejected(self):
        """Verify PUT /api/lessons/<id> requires admin authentication (HTTP 401)"""
        res = self.client.put('/api/lessons/037', json={'title': 'Hacked Title'})
        self.assertEqual(res.status_code, 401)

    def test_04_unauthenticated_ocr_scan_rejected(self):
        """Verify POST /api/lessons/<id>/ocr-scan requires admin authentication (HTTP 401)"""
        res = self.client.post('/api/lessons/037/ocr-scan')
        self.assertEqual(res.status_code, 401)

    def test_05_unauthenticated_fetch_api_rejected(self):
        """Verify POST /api/lessons/<id>/fetch-api requires admin authentication (HTTP 401)"""
        res = self.client.post('/api/lessons/037/fetch-api')
        self.assertEqual(res.status_code, 401)

    def test_06_path_traversal_in_page_serving_blocked(self):
        """Verify path traversal in /api/pages/<folder>/<filename> is rejected (CWE-22)"""
        # Traversal in folder name
        res = self.client.get('/api/pages/..%2F..%2F/page_1.png')
        self.assertIn(res.status_code, [400, 404])

        res2 = self.client.get('/api/pages/folder_with_invalid$chars!/page_1.png')
        self.assertEqual(res2.status_code, 400)

        # Traversal in filename
        res3 = self.client.get('/api/pages/lesson_037/..%2F..%2Fapp.py')
        self.assertIn(res3.status_code, [400, 404])

    def test_07_invalid_lesson_number_blocked(self):
        """Verify malicious lesson number formats are rejected"""
        login_res = self.client.post('/api/auth/login', json={
            'username': 'nimalakasiotis',
            'password': 'NikosM2025!'
        })
        self.assertEqual(login_res.status_code, 200)
        token = login_res.get_json()['token']
        headers = {'Authorization': f'Bearer {token}'}

        # Attempt path traversal in lesson number
        res = self.client.post('/api/lessons', headers=headers, data={
            'number': '../../evil_lesson',
            'title': 'Bad Lesson'
        })
        self.assertEqual(res.status_code, 400)

    def test_08_invalid_pdf_file_rejected(self):
        """Verify non-PDF file uploads are rejected"""
        login_res = self.client.post('/api/auth/login', json={
            'username': 'nimalakasiotis',
            'password': 'NikosM2025!'
        })
        token = login_res.get_json()['token']
        headers = {'Authorization': f'Bearer {token}'}

        # Upload a fake .exe pretending to be PDF
        fake_data = (io.BytesIO(b'MZ\x90\x00\x03ThisIsNotAPdf'), 'malware.pdf')
        res = self.client.post('/api/lessons', headers=headers, data={
            'number': '998',
            'title': 'Test File',
            'pdf_file': fake_data
        }, content_type='multipart/form-data')
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn('PDF', data.get('error', ''))

    def test_09_auth_login_verify_logout_cycle(self):
        """Verify complete authentication lifecycle with token expiration checks"""
        # Invalid password
        bad_res = self.client.post('/api/auth/login', json={
            'username': 'nimalakasiotis',
            'password': 'wrongpassword'
        })
        self.assertEqual(bad_res.status_code, 401)

        # Valid login
        login_res = self.client.post('/api/auth/login', json={
            'username': 'nimalakasiotis',
            'password': 'NikosM2025!'
        })
        self.assertEqual(login_res.status_code, 200)
        data = login_res.get_json()
        token = data['token']
        self.assertTrue(len(token) >= 32)

        # Verify token
        verify_res = self.client.get('/api/auth/verify', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(verify_res.status_code, 200)
        self.assertTrue(verify_res.get_json()['authenticated'])

        # Logout
        logout_res = self.client.post('/api/auth/logout', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(logout_res.status_code, 200)

        # Verify after logout
        verify_after = self.client.get('/api/auth/verify', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(verify_after.status_code, 401)

if __name__ == '__main__':
    unittest.main()
