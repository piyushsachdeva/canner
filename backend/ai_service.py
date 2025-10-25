"""
AI-powered response suggestion service for Canner
Integrates with Groq API to provide contextual suggestions
"""

import os
import json
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    logging.warning("Groq not available. AI suggestions disabled.")


@dataclass
class SuggestionContext:
    """Context information for generating suggestions"""
    platform: str  # linkedin, twitter, github, etc.
    conversation_text: str  # Previous messages/context
    user_input: str  # What user has typed so far
    tone: str = "professional"  # professional, casual, friendly, formal
    max_length: int = 280  # Platform-specific limits


class AIResponseService:
    """Service for generating AI-powered response suggestions using Groq"""
    
    def __init__(self):
        self.api_key = os.getenv('GROQ_API_KEY')
        self.client = None
        self.model = os.getenv('GROQ_MODEL', 'llama3-8b-8192')  # Default to Llama 3 8B
        
        if self.api_key and GROQ_AVAILABLE:
            try:
                self.client = Groq(api_key=self.api_key)
                logging.info("✅ Groq AI service initialized")
            except Exception as e:
                logging.error(f"Failed to initialize Groq client: {e}")
                self.client = None
        else:
            if not self.api_key:
                logging.warning("Groq API key not found. AI suggestions disabled.")
            if not GROQ_AVAILABLE:
                logging.warning("Groq library not installed. AI suggestions disabled.")
    
    def is_available(self) -> bool:
        """Check if AI service is available"""
        return bool(self.client and self.api_key)
    
    def generate_suggestions(self, context: SuggestionContext) -> List[Dict]:
        """Generate multiple response suggestions based on context"""
        if not self.is_available():
            return []
        
        try:
            # Create platform-specific prompts
            system_prompt = self._build_system_prompt(context)
            user_prompt = self._build_user_prompt(context)
            
            # Generate multiple suggestions by making multiple calls
            # Groq doesn't support n parameter like OpenAI, so we make separate calls
            suggestions = []
            
            for i in range(3):  # Generate 3 different suggestions
                try:
                    response = self.client.chat.completions.create(
                        model=self.model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        max_tokens=300,
                        temperature=0.7 + (i * 0.1),  # Vary temperature for diversity
                        top_p=0.9,
                        stream=False
                    )
                    
                    if response.choices and response.choices[0].message:
                        content = response.choices[0].message.content.strip()
                        if content and len(content) <= context.max_length:
                            # Check for duplicates
                            if not any(s["content"] == content for s in suggestions):
                                suggestions.append({
                                    "content": content,
                                    "confidence": self._calculate_confidence(content, context),
                                    "tone": context.tone,
                                    "platform": context.platform,
                                    "model": self.model
                                })
                
                except Exception as e:
                    logging.warning(f"Failed to generate suggestion {i+1}: {e}")
                    continue
            
            return suggestions
            
        except Exception as e:
            logging.error(f"AI suggestion generation failed: {e}")
            return []
    
    def _build_system_prompt(self, context: SuggestionContext) -> str:
        """Build system prompt based on platform and tone"""
        platform_guidelines = {
            "linkedin": "Professional networking platform. Responses should be business-appropriate, networking-focused, and career-oriented.",
            "twitter": "Social media platform with character limits. Responses should be concise, engaging, and conversational.",
            "github": "Developer platform. Responses should be technical, helpful, and collaborative.",
            "discord": "Chat platform. Responses should be casual, community-focused, and conversational."
        }
        
        tone_guidelines = {
            "professional": "Maintain a professional, respectful tone. Use proper grammar and formal language.",
            "casual": "Use a relaxed, friendly tone. Contractions and informal language are acceptable.",
            "friendly": "Be warm and approachable. Show enthusiasm and positivity.",
            "formal": "Use very formal language. Avoid contractions and maintain strict professionalism."
        }
        
        platform_guide = platform_guidelines.get(context.platform, "General social platform")
        tone_guide = tone_guidelines.get(context.tone, "Maintain appropriate tone")
        
        return f"""You are an AI assistant helping users write responses on {context.platform}.
        
Platform context: {platform_guide}
Tone requirement: {tone_guide}
Character limit: {context.max_length}

Generate appropriate, helpful responses that:
1. Match the requested tone exactly
2. Are relevant to the conversation context
3. Stay within {context.max_length} characters
4. Are grammatically correct and natural
5. Add value to the conversation
6. Are engaging and authentic

Important: Respond with ONLY the suggested message text, no explanations or quotes."""
    
    def _build_user_prompt(self, context: SuggestionContext) -> str:
        """Build user prompt with conversation context"""
        prompt = f"Platform: {context.platform}\n"
        prompt += f"Tone: {context.tone}\n"
        
        if context.conversation_text:
            prompt += f"Conversation context: {context.conversation_text}\n"
        
        if context.user_input:
            prompt += f"User has started typing: {context.user_input}\n"
        
        prompt += f"Generate a {context.tone} response (max {context.max_length} characters):"
        
        return prompt
    
    def _calculate_confidence(self, content: str, context: SuggestionContext) -> float:
        """Calculate confidence score for suggestion"""
        confidence = 0.8  # Base confidence
        
        # Adjust based on length appropriateness
        if len(content) > context.max_length * 0.9:
            confidence -= 0.1
        elif len(content) < context.max_length * 0.3:
            confidence -= 0.05
        
        # Adjust based on context relevance (simple keyword matching)
        if context.conversation_text:
            common_words = set(content.lower().split()) & set(context.conversation_text.lower().split())
            if len(common_words) > 2:
                confidence += 0.1
        
        return min(1.0, max(0.1, confidence))


class ResponseAnalytics:
    """Analytics service for tracking response usage and effectiveness"""
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    def track_suggestion_usage(self, suggestion_id: str, user_action: str):
        """Track how users interact with AI suggestions"""
        # user_action: 'accepted', 'rejected', 'modified'
        pass
    
    def get_popular_responses(self, limit: int = 10) -> List[Dict]:
        """Get most frequently used responses"""
        pass
    
    def get_usage_analytics(self, days: int = 30) -> Dict:
        """Get usage statistics for the last N days"""
        pass