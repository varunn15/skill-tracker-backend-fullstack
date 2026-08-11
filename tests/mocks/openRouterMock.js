// tests/mocks/openRouterMock.js

const mockAIResponse = {
  score: 50,
  strengths: ['HTML (8/10) - Strong foundation'],
  weaknesses: ['JavaScript (4/10) - Needs improvement'],
  recommendations: ['Learn JavaScript', 'Build React projects'],
  summary: 'You have a solid foundation in HTML. To become a Frontend Developer, you need to learn JavaScript and a modern framework like React.',
  _meta: {
    status: 'success',
    cache: 'MISS',
    latency: '100ms'
  }
};

const mockCacheHitResponse = {
  ...mockAIResponse,
  _meta: {
    ...mockAIResponse._meta,
    cache: 'HIT',
    servedAt: new Date().toISOString()
  }
};

// Mock the OpenRouter API call
const mockCallOpenRouter = jest.fn().mockResolvedValue(mockAIResponse);

module.exports = {
  mockAIResponse,
  mockCacheHitResponse,
  mockCallOpenRouter
};