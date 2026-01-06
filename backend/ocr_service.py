import easyocr
import re
from typing import Optional, Dict
import os

class CNICOCRService:
    _instance = None
    _reader = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        pass
    
    @property
    def reader(self):
        if CNICOCRService._reader is None:
            print("Initializing EasyOCR reader (lazy load)...")
            CNICOCRService._reader = easyocr.Reader(['en'], gpu=False)
            print("EasyOCR reader initialized successfully")
        return CNICOCRService._reader
    
    def extract_cnic_info(self, front_image_path: str, back_image_path: str) -> Dict:
        """Extract information from CNIC front and back images"""
        result = {
            'cnic_extracted': None,
            'full_name': None,
            'father_name': None,
            'date_of_birth': None,
            'gender': None,
            'address': None
        }
        
        try:
            # Read front image
            front_text_results = self.reader.readtext(front_image_path, detail=0)
            front_text = ' '.join(front_text_results)
            print(f"Front OCR text: {front_text}")
            
            # Read back image
            back_text_results = self.reader.readtext(back_image_path, detail=0)
            back_text = ' '.join(back_text_results)
            print(f"Back OCR text: {back_text}")
            
            all_text = front_text + ' ' + back_text
            
            # Extract CNIC number
            result['cnic_extracted'] = self._extract_cnic_number(all_text)
            
            # Extract name (usually after "Name" on front)
            result['full_name'] = self._extract_name(front_text_results)
            
            # Extract father name
            result['father_name'] = self._extract_father_name(front_text_results)
            
            # Extract date of birth
            result['date_of_birth'] = self._extract_dob(all_text)
            
            # Extract gender
            result['gender'] = self._extract_gender(all_text)
            
            # Extract address (usually on back)
            result['address'] = self._extract_address(back_text_results)
            
        except Exception as e:
            print(f"OCR extraction error: {e}")
        
        return result
    
    def _extract_cnic_number(self, text: str) -> Optional[str]:
        """Extract 13-digit CNIC number from text"""
        # Pattern: XXXXX-XXXXXXX-X or 13 consecutive digits
        patterns = [
            r'\d{5}-\d{7}-\d',  # Format: 12345-1234567-1
            r'\d{13}',          # 13 consecutive digits
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group().replace('-', '')
        return None
    
    def _extract_name(self, text_list: list) -> Optional[str]:
        """Extract name from OCR results"""
        # Look for text after "Name" keyword
        for i, text in enumerate(text_list):
            if 'name' in text.lower() and 'father' not in text.lower():
                # Return next non-empty text that looks like a name
                if i + 1 < len(text_list):
                    potential_name = text_list[i + 1]
                    if len(potential_name) > 2 and not potential_name.isdigit():
                        return potential_name.strip()
        
        # Alternative: Look for capitalized text sequences
        for text in text_list:
            if len(text) > 5 and text[0].isupper() and not text.isdigit():
                words = text.split()
                if len(words) >= 2:
                    return text.strip()
        
        return None
    
    def _extract_father_name(self, text_list: list) -> Optional[str]:
        """Extract father's name from OCR results"""
        for i, text in enumerate(text_list):
            if 'father' in text.lower() or 'f/o' in text.lower() or 's/o' in text.lower():
                if i + 1 < len(text_list):
                    potential_name = text_list[i + 1]
                    if len(potential_name) > 2 and not potential_name.isdigit():
                        return potential_name.strip()
        return None
    
    def _extract_dob(self, text: str) -> Optional[str]:
        """Extract date of birth from text"""
        # Common date formats on CNIC
        patterns = [
            r'\d{2}[./-]\d{2}[./-]\d{4}',  # DD/MM/YYYY or DD-MM-YYYY
            r'\d{4}[./-]\d{2}[./-]\d{2}',  # YYYY-MM-DD
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group()
        return None
    
    def _extract_gender(self, text: str) -> Optional[str]:
        """Extract gender from text"""
        text_lower = text.lower()
        if 'male' in text_lower:
            if 'female' in text_lower:
                # Check which comes first or is more prominent
                if text_lower.find('female') < text_lower.find('male'):
                    return 'Female'
            return 'Male'
        elif 'female' in text_lower:
            return 'Female'
        elif ' m ' in text_lower or text_lower.endswith(' m'):
            return 'Male'
        elif ' f ' in text_lower or text_lower.endswith(' f'):
            return 'Female'
        return None
    
    def _extract_address(self, text_list: list) -> Optional[str]:
        """Extract address from back of CNIC"""
        # Address is usually a longer text on the back
        address_parts = []
        capture = False
        
        for text in text_list:
            if 'address' in text.lower():
                capture = True
                continue
            if capture and len(text) > 3:
                address_parts.append(text)
        
        if address_parts:
            return ' '.join(address_parts[:3])  # Take first 3 parts
        
        # Fallback: Look for longer text sequences on back
        long_texts = [t for t in text_list if len(t) > 15]
        if long_texts:
            return long_texts[0]
        
        return None


# Singleton instance
ocr_service = CNICOCRService()
