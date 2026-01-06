"""
Transcription service using OpenAI Whisper and spaCy for keyword extraction.
Runs transcription in a background thread to avoid blocking the main API.
"""

import whisper
import spacy
import threading
import logging
from pathlib import Path
from typing import Optional, Dict, List
from sqlalchemy.orm import Session

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model instances (loaded lazily)
_whisper_model = None
_spacy_model = None


def get_whisper_model():
    """Lazy load Whisper model (small)"""
    global _whisper_model
    if _whisper_model is None:
        logger.info("Loading Whisper 'small' model... (first time may take a while)")
        _whisper_model = whisper.load_model("small")
        logger.info("Whisper model loaded successfully")
    return _whisper_model


def get_spacy_model():
    """Lazy load spaCy model"""
    global _spacy_model
    if _spacy_model is None:
        try:
            _spacy_model = spacy.load("en_core_web_sm")
            logger.info("spaCy model loaded successfully")
        except OSError:
            logger.warning("spaCy model not found. Downloading en_core_web_sm...")
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"])
            _spacy_model = spacy.load("en_core_web_sm")
    return _spacy_model


def transcribe_audio(audio_path: str) -> Optional[str]:
    """
    Transcribe audio file using Whisper.
    
    Args:
        audio_path: Path to the audio file
        
    Returns:
        Transcribed text or None if failed
    """
    try:
        if not Path(audio_path).exists():
            logger.error(f"Audio file not found: {audio_path}")
            return None
        
        model = get_whisper_model()
        result = model.transcribe(audio_path)
        return result["text"].strip()
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return None


def extract_keywords(text: str, max_keywords: int = 10) -> List[str]:
    """
    Extract keywords from text using spaCy.
    Focuses on nouns, proper nouns, and verbs.
    
    Args:
        text: Input text
        max_keywords: Maximum number of keywords to return
        
    Returns:
        List of keywords
    """
    if not text:
        return []
    
    try:
        nlp = get_spacy_model()
        doc = nlp(text)
        
        # Extract important words (nouns, proper nouns, verbs)
        keywords = []
        for token in doc:
            # Skip stopwords, punctuation, and short words
            if token.is_stop or token.is_punct or len(token.text) < 3:
                continue
            
            # Focus on meaningful parts of speech
            if token.pos_ in ['NOUN', 'PROPN', 'VERB', 'ADJ']:
                # Use lemma (base form) for consistency
                word = token.lemma_.lower()
                if word not in keywords:
                    keywords.append(word)
        
        # Also extract named entities (locations, organizations, etc.)
        for ent in doc.ents:
            if ent.label_ in ['GPE', 'LOC', 'ORG', 'PERSON', 'EVENT']:
                ent_text = ent.text.lower()
                if ent_text not in keywords:
                    keywords.insert(0, ent_text)  # Prioritize entities
        
        return keywords[:max_keywords]
    except Exception as e:
        logger.error(f"Keyword extraction error: {e}")
        return []


def process_transcription_background(alert_id: int, audio_path: str, db_session_factory):
    """
    Background task to transcribe audio and extract keywords.
    Updates the database with results.
    
    Args:
        alert_id: ID of the alert to update
        audio_path: Path to audio file
        db_session_factory: Function to create database session
    """
    def _process():
        logger.info(f"Starting transcription for alert {alert_id}")
        
        # Create new session for background thread
        db = db_session_factory()
        
        try:
            from models import Alert
            alert = db.query(Alert).filter(Alert.id == alert_id).first()
            
            if not alert:
                logger.error(f"Alert {alert_id} not found")
                return
            
            # Transcribe
            transcription = transcribe_audio(audio_path)
            
            if transcription:
                # Extract keywords
                keywords = extract_keywords(transcription)
                
                # Update alert
                alert.transcription = transcription
                alert.transcription_keywords = ", ".join(keywords) if keywords else None
                alert.transcription_status = 'completed'
                
                logger.info(f"Transcription completed for alert {alert_id}: {len(transcription)} chars, {len(keywords)} keywords")
            else:
                alert.transcription_status = 'failed'
                logger.error(f"Transcription failed for alert {alert_id}")
            
            db.commit()
        except Exception as e:
            logger.error(f"Background transcription error for alert {alert_id}: {e}")
            try:
                from models import Alert
                alert = db.query(Alert).filter(Alert.id == alert_id).first()
                if alert:
                    alert.transcription_status = 'failed'
                    db.commit()
            except:
                pass
        finally:
            db.close()
    
    # Run in background thread
    thread = threading.Thread(target=_process, daemon=True)
    thread.start()
    logger.info(f"Background transcription thread started for alert {alert_id}")


def start_transcription(alert_id: int, audio_path: str, db_session_factory):
    """
    Entry point to start transcription process.
    Sets status to pending and launches background task.
    """
    process_transcription_background(alert_id, audio_path, db_session_factory)
