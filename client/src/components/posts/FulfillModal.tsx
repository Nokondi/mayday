import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, User, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fulfillPost, searchFulfillers } from '../../api/posts.js';
import { useDebounce } from '../../hooks/useDebounce.js';

interface Fulfiller {
  name: string;
  userId?: string;
  organizationId?: string;
}

interface FulfillModalProps {
  postId: string;
  open: boolean;
  onClose: () => void;
}

export function FulfillModal({ postId, open, onClose }: FulfillModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const [fulfillers, setFulfillers] = useState<Fulfiller[]>([{ name: '' }]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<{
    users: Array<{ id: string; name: string; avatarUrl: string | null }>;
    organizations: Array<{ id: string; name: string; avatarUrl: string | null }>;
  }>({ users: [], organizations: [] });
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults({ users: [], organizations: [] });
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchFulfillers(debouncedQuery).then((results) => {
      if (!cancelled) {
        setSearchResults(results);
        setSearching(false);
      }
    }).catch(() => {
      if (!cancelled) setSearching(false);
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const fulfillMutation = useMutation({
    mutationFn: () => fulfillPost(postId, {
      fulfillers: fulfillers.filter(f => f.name.trim()),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post marked as fulfilled');
      resetAndClose();
    },
    onError: () => toast.error('Failed to mark post as fulfilled'),
  });

  const resetAndClose = () => {
    setFulfillers([{ name: '' }]);
    setActiveIndex(null);
    setSearchQuery('');
    setSearchResults({ users: [], organizations: [] });
    onClose();
  };

  const updateFulfiller = (index: number, update: Partial<Fulfiller>) => {
    setFulfillers(prev => prev.map((f, i) => i === index ? { ...f, ...update } : f));
  };

  const addFulfiller = () => {
    setFulfillers(prev => [...prev, { name: '' }]);
  };

  const removeFulfiller = (index: number) => {
    setFulfillers(prev => prev.filter((_, i) => i !== index));
    if (activeIndex === index) {
      setActiveIndex(null);
      setSearchQuery('');
    }
  };

  const selectSuggestion = (index: number, suggestion: { id: string; name: string }, type: 'user' | 'organization') => {
    updateFulfiller(index, {
      name: suggestion.name,
      userId: type === 'user' ? suggestion.id : undefined,
      organizationId: type === 'organization' ? suggestion.id : undefined,
    });
    setActiveIndex(null);
    setSearchQuery('');
    setSearchResults({ users: [], organizations: [] });
  };

  const handleNameChange = (index: number, value: string) => {
    updateFulfiller(index, { name: value, userId: undefined, organizationId: undefined });
    setActiveIndex(index);
    setSearchQuery(value);
  };

  const handleNameBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setActiveIndex(null);
      setSearchQuery('');
    }, 200);
  };

  const validCount = fulfillers.filter(f => f.name.trim()).length;

  const hasResults = searchResults.users.length > 0 || searchResults.organizations.length > 0;

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-black/50 bg-transparent p-0 m-auto max-w-lg w-full"
      onClick={(e) => { if (e.target === dialogRef.current) resetAndClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Mark as Fulfilled</h2>
          <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Who helped fulfill this request? You can add multiple people or organizations.
        </p>

        <div className="space-y-3 mb-4">
          {fulfillers.map((fulfiller, index) => (
            <div key={index} className="relative flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={fulfiller.name}
                  onChange={(e) => handleNameChange(index, e.target.value)}
                  onFocus={() => { setActiveIndex(index); setSearchQuery(fulfiller.name); }}
                  onBlur={handleNameBlur}
                  placeholder="Type a name to search..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
                />
                {fulfiller.userId && (
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                )}
                {fulfiller.organizationId && (
                  <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                )}

                {activeIndex === index && (hasResults || searching) && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searching && (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" /> Searching...
                      </div>
                    )}
                    {searchResults.users.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase bg-gray-50">Users</div>
                        {searchResults.users.map((u) => (
                          <button
                            key={`user-${u.id}`}
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 text-left"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectSuggestion(index, u, 'user')}
                          >
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-gray-400" />
                            )}
                            {u.name}
                          </button>
                        ))}
                      </>
                    )}
                    {searchResults.organizations.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase bg-gray-50">Organizations</div>
                        {searchResults.organizations.map((o) => (
                          <button
                            key={`org-${o.id}`}
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 text-left"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectSuggestion(index, o, 'organization')}
                          >
                            {o.avatarUrl ? (
                              <img src={o.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <Building2 className="w-5 h-5 text-gray-400" />
                            )}
                            {o.name}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {fulfillers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFulfiller(index)}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addFulfiller}
          className="flex items-center gap-1 text-sm text-mayday-600 hover:text-mayday-700 mb-6"
        >
          <Plus className="w-4 h-4" /> Add another
        </button>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={resetAndClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => fulfillMutation.mutate()}
            disabled={validCount === 0 || fulfillMutation.isPending}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {fulfillMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Mark as Fulfilled
          </button>
        </div>
      </div>
    </dialog>
  );
}
