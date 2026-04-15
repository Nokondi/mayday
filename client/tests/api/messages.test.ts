import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../../src/api/client.js';
import {
  getConversationMessages,
  getConversations,
  sendMessage,
  startConversation,
} from '../../src/api/messages.js';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('messages api', () => {
  describe('getConversations', () => {
    it('GETs /messages/conversations and returns the list', async () => {
      const response = [{ id: 'cv1' }, { id: 'cv2' }];
      mockedApi.get.mockResolvedValueOnce({ data: response });

      const result = await getConversations();

      expect(mockedApi.get).toHaveBeenCalledWith('/messages/conversations');
      expect(result).toEqual(response);
    });
  });

  describe('getConversationMessages', () => {
    it('GETs /messages/conversations/:id with the provided page', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [] });

      await getConversationMessages('cv1', 3);

      expect(mockedApi.get).toHaveBeenCalledWith('/messages/conversations/cv1', {
        params: { page: 3 },
      });
    });

    it('defaults to page 1 when no page is provided', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [] });

      await getConversationMessages('cv1');

      expect(mockedApi.get).toHaveBeenCalledWith('/messages/conversations/cv1', {
        params: { page: 1 },
      });
    });

    it('returns the response body', async () => {
      const messages = [{ id: 'm1' }];
      mockedApi.get.mockResolvedValueOnce({ data: messages });
      await expect(getConversationMessages('cv1')).resolves.toEqual(messages);
    });
  });

  describe('startConversation', () => {
    it('POSTs /messages/conversations with the payload', async () => {
      const payload = { recipientId: 'u2' } as never;
      mockedApi.post.mockResolvedValueOnce({ data: { id: 'cv1' } });

      const result = await startConversation(payload);

      expect(mockedApi.post).toHaveBeenCalledWith('/messages/conversations', payload);
      expect(result).toEqual({ id: 'cv1' });
    });
  });

  describe('sendMessage', () => {
    it('POSTs the message content to the conversation endpoint', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { id: 'm1', content: 'hi' } });

      const result = await sendMessage('cv1', 'hi');

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/messages/conversations/cv1/messages',
        { content: 'hi' },
      );
      expect(result).toEqual({ id: 'm1', content: 'hi' });
    });
  });
});
