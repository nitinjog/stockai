"""Validated shapes for LLM outputs. Extra keys from the model are ignored."""
from pydantic import BaseModel, Field


class Topic(BaseModel):
    title: str
    why_trending: str = ""
    angle: str = ""
    evidence_urls: list[str] = Field(default_factory=list)


class TopicList(BaseModel):
    topics: list[Topic]


class Fact(BaseModel):
    claim: str
    source_url: str = ""
    verified: bool = False  # set in code: source_url must be one of the researched sources


class Source(BaseModel):
    title: str = ""
    url: str


class FactSheet(BaseModel):
    topic: str
    summary: str
    facts: list[Fact]
    sources: list[Source] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)


class Beat(BaseModel):
    name: str
    summary: str


class Storyline(BaseModel):
    logline: str
    audience_hook: str = ""
    beats: list[Beat]


class Scene(BaseModel):
    n: int = 0
    narration: str
    visual_prompt: str
    on_screen_text: str = ""


class Script(BaseModel):
    title: str
    scenes: list[Scene]
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    thumbnail_prompt: str = ""
    thumbnail_text: str = ""


class Issue(BaseModel):
    scene: int = 0
    claim: str
    problem: str


class FactCheck(BaseModel):
    issues: list[Issue] = Field(default_factory=list)
