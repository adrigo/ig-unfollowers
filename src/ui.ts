import { UserNode } from './types';
import { unfollowUser, setCachedFollowings } from './api';

export function renderList(
  bodyEl: HTMLElement,
  initialUsers: UserNode[],
  csrfToken: string,
  dsUserId: string
): { cancelBulk: () => void } {
  let activeUsers = [...initialUsers];
  let showNonFollowers = true;
  let showFollowers = false;
  let showVerified = true;
  let isGridView = false;

  // Bulk action states
  let isBulkPaused = false;
  let isBulkCancelled = false;

  const selectedUserIds = new Set<string>();

  bodyEl.innerHTML = `
    <div class="iu-layout-wrapper">
      <div class="iu-sidebar">
        <!-- Search bar -->
        <div class="iu-sidebar-section">
          <div style="font-weight: bold; color: #fff; font-size: 0.82rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Search:</div>
          <input type="text" class="iu-search-input" id="iu-search" placeholder="Username or name..." style="width: 100%; box-sizing: border-box;" />
        </div>
        
        <!-- Actions Group -->
        <div class="iu-sidebar-section iu-sidebar-actions">
          <button class="iu-btn-export" id="iu-bulk-unfollow-btn" style="width: 100%; background: #ef4444; border-color: rgba(239, 68, 68, 0.4); text-align: center;" disabled>Unfollow (0)</button>
          <div class="iu-btn-group">
            <button class="iu-btn-export" id="iu-layout-btn" style="flex: 1; text-align: center;">Grid View</button>
            <button class="iu-btn-export" id="iu-export-btn" style="flex: 1; text-align: center;">Export</button>
          </div>
        </div>

        <!-- Sort Select -->
        <div class="iu-sidebar-section">
          <div style="font-weight: bold; color: #fff; font-size: 0.82rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Sort By:</div>
          <select id="iu-sort-select" style="width: 100%; box-sizing: border-box;">
            <option value="name-asc">A-Z (Username)</option>
            <option value="name-desc">Z-A (Username)</option>
            <option value="private-first">🔒 Private First</option>
            <option value="verified-first">✓ Verified First</option>
          </select>
        </div>

        <!-- Filter Checkboxes -->
        <div class="iu-sidebar-section">
          <div style="font-weight: bold; color: #fff; font-size: 0.82rem; margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em;">Filters:</div>
          <div class="iu-filter-list">
            <label class="iu-filter-label">
              <input type="checkbox" id="iu-filter-nonfollowers" ${showNonFollowers ? 'checked' : ''} />
              Non-followers
            </label>
            <label class="iu-filter-label">
              <input type="checkbox" id="iu-filter-followers" ${showFollowers ? 'checked' : ''} />
              Followers
            </label>
            <label class="iu-filter-label">
              <input type="checkbox" id="iu-filter-verified" ${showVerified ? 'checked' : ''} />
              Show Verified
            </label>
          </div>
        </div>

        <!-- Vertical Stats Dashboard -->
        <div class="iu-sidebar-section" style="border-bottom: none; padding-bottom: 0;">
          <div style="font-weight: bold; color: #fff; font-size: 0.82rem; margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em;">Statistics:</div>
          <div class="iu-stats-vertical">
            <div class="iu-stat-row">
              <span>Non-followers</span>
              <span id="stat-nonfollowers" class="iu-stat-val non-followers">0</span>
            </div>
            <div class="iu-stat-row">
              <span>Followers</span>
              <span id="stat-followers" class="iu-stat-val followers">0</span>
            </div>
            <div class="iu-stat-row">
              <span>Verified</span>
              <span id="stat-verified" class="iu-stat-val verified">0</span>
            </div>
            <div class="iu-stat-row">
              <span>Private</span>
              <span id="stat-private" class="iu-stat-val private">0</span>
            </div>
          </div>
        </div>
      </div>

      <div class="iu-content-area">
        <!-- Progress banner for bulk unfollow operations -->
        <div id="iu-bulk-progress-banner">
          <span id="iu-bulk-progress-text" style="font-weight: 600;">Unfollowing: 0/0</span>
          <div class="iu-btn-group" style="width: auto;">
            <button id="iu-bulk-pause-btn" class="iu-btn-export" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: rgba(255, 255, 255, 0.08); border-radius: 6px;">Pause</button>
            <button id="iu-bulk-cancel-btn" class="iu-btn-export" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: #ef4444; border: none; border-radius: 6px;">Cancel</button>
          </div>
        </div>

        <!-- Selection controller & counter -->
        <div class="iu-content-header">
          <label class="iu-filter-label">
            <input type="checkbox" id="iu-select-all" />
            <span style="font-weight: bold; color: #fff; font-size: 0.88rem;">Select All Visible</span>
          </label>
          <span id="iu-count-text" style="font-size: 0.85rem; color: #ada79d;">Loading list...</span>
        </div>

        <!-- The scrollable list view -->
        <div class="iu-list-container" id="iu-list">
          <!-- Rendered dynamically -->
        </div>
      </div>
    </div>
  `;

  const listEl = document.getElementById('iu-list')!;
  const searchInput = document.getElementById('iu-search') as HTMLInputElement;
  const countTextEl = document.getElementById('iu-count-text')!;
  const exportBtn = document.getElementById('iu-export-btn') as HTMLButtonElement;
  const layoutBtn = document.getElementById('iu-layout-btn') as HTMLButtonElement;
  const bulkUnfollowBtn = document.getElementById('iu-bulk-unfollow-btn') as HTMLButtonElement;

  const nonFollowersCheck = document.getElementById('iu-filter-nonfollowers') as HTMLInputElement;
  const followersCheck = document.getElementById('iu-filter-followers') as HTMLInputElement;
  const verifiedCheck = document.getElementById('iu-filter-verified') as HTMLInputElement;
  const selectAllCheck = document.getElementById('iu-select-all') as HTMLInputElement;
  const sortSelect = document.getElementById('iu-sort-select') as HTMLSelectElement;

  const progressBanner = document.getElementById('iu-bulk-progress-banner')!;
  const progressText = document.getElementById('iu-bulk-progress-text')!;
  const pauseBtn = document.getElementById('iu-bulk-pause-btn')!;
  const cancelBtn = document.getElementById('iu-bulk-cancel-btn')!;

  // Filtered reference for exports and bulk actions
  let currentFilteredList: UserNode[] = [];

  const updateStatsCounters = () => {
    const nonFollowers = activeUsers.filter(u => !u.followsViewer).length;
    const followers = activeUsers.filter(u => u.followsViewer).length;
    const verified = activeUsers.filter(u => u.isVerified).length;
    const privateCount = activeUsers.filter(u => u.isPrivate).length;

    document.getElementById('stat-nonfollowers')!.textContent = String(nonFollowers);
    document.getElementById('stat-followers')!.textContent = String(followers);
    document.getElementById('stat-verified')!.textContent = String(verified);
    document.getElementById('stat-private')!.textContent = String(privateCount);
  };

  const updateBulkButton = () => {
    bulkUnfollowBtn.disabled = selectedUserIds.size === 0;
    bulkUnfollowBtn.textContent = `Unfollow (${selectedUserIds.size})`;
  };

  const syncSelectAllState = () => {
    const allVisibleSelected = currentFilteredList.length > 0 && currentFilteredList.every(u => selectedUserIds.has(u.id));
    selectAllCheck.checked = allVisibleSelected;
  };

  const updateUIList = () => {
    const term = searchInput.value.toLowerCase().trim();

    currentFilteredList = activeUsers.filter(u => {
      // Search filter
      const matchesSearch = u.username.toLowerCase().includes(term) || u.fullName.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      // Follower filter
      const matchesStatus = (showNonFollowers && !u.followsViewer) || (showFollowers && u.followsViewer);
      if (!matchesStatus) return false;

      // Verified filter
      const matchesVerified = !u.isVerified || showVerified;
      if (!matchesVerified) return false;

      return true;
    });

    // Apply Sorting
    const sortBy = sortSelect.value;
    if (sortBy === 'name-asc') {
      currentFilteredList.sort((a, b) => a.username.localeCompare(b.username));
    } else if (sortBy === 'name-desc') {
      currentFilteredList.sort((a, b) => b.username.localeCompare(a.username));
    } else if (sortBy === 'private-first') {
      currentFilteredList.sort((a, b) => {
        if (a.isPrivate && !b.isPrivate) return -1;
        if (!a.isPrivate && b.isPrivate) return 1;
        return a.username.localeCompare(b.username);
      });
    } else if (sortBy === 'verified-first') {
      currentFilteredList.sort((a, b) => {
        if (a.isVerified && !b.isVerified) return -1;
        if (!a.isVerified && b.isVerified) return 1;
        return a.username.localeCompare(b.username);
      });
    }

    countTextEl.textContent = `Showing ${currentFilteredList.length} of ${activeUsers.length} followed accounts.`;

    if (currentFilteredList.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; color: #ada79d; padding: 3rem 0;">
          No users match your criteria.
        </div>
      `;
      return;
    }

    listEl.innerHTML = currentFilteredList.map(user => `
      <div class="iu-user-card" id="card-${user.id}">
        <div class="iu-user-info">
          <input type="checkbox" class="iu-user-checkbox" data-id="${user.id}" ${selectedUserIds.has(user.id) ? 'checked' : ''} />
          <img class="iu-avatar" src="${user.profilePicUrl}" alt="${user.username}" />
          <div class="iu-names">
            <div>
              <a class="iu-username" href="https://www.instagram.com/${user.username}/" target="_blank">${user.username}</a>
              ${user.isVerified ? '<span class="iu-badge iu-badge-verified">✓ Verified</span>' : ''}
              ${user.isPrivate ? '<span class="iu-badge iu-badge-private">🔒 Private</span>' : ''}
              ${user.followsViewer ? '<span class="iu-badge iu-badge-follower">Follows you</span>' : ''}
            </div>
            <span class="iu-fullname">${user.fullName}</span>
          </div>
        </div>
        <button class="iu-unfollow-btn" data-id="${user.id}">Unfollow</button>
      </div>
    `).join('');

    syncSelectAllState();
  };

  // Unfollow action
  const triggerUnfollow = async (user: UserNode, btn: HTMLButtonElement) => {
    btn.disabled = true;
    btn.textContent = '...';
    try {
      const res = await unfollowUser(user.id, csrfToken);
      if (res.ok) {
        btn.textContent = 'Unfollowed';
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.color = '#ada79d';
        
        // Remove from local lists
        activeUsers = activeUsers.filter(u => u.id !== user.id);
        selectedUserIds.delete(user.id);
        
        // Save to local cache
        setCachedFollowings(dsUserId, activeUsers);
        
        setTimeout(() => {
          updateUIList();
          updateStatsCounters();
          updateBulkButton();
        }, 800);
      } else {
        if (res.status === 429) {
          alert('Instagram rate limit detected (HTTP 429). Please wait a few minutes before trying to unfollow again.');
        }
        throw new Error('API Error');
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Unfollow';
      if (!(err instanceof Error) || err.message !== 'API Error') {
        alert(`Failed to unfollow @${user.username}. Try again later.`);
      }
    }
  };

  // Event Delegation: Checkbox Change Listener
  listEl.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('iu-user-checkbox')) {
      const id = target.getAttribute('data-id')!;
      const isChecked = (target as HTMLInputElement).checked;
      
      if (isChecked) {
        selectedUserIds.add(id);
      } else {
        selectedUserIds.delete(id);
      }
      
      updateBulkButton();
      syncSelectAllState();
    }
  });

  // Event Delegation: Unfollow Button Click Listener
  listEl.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('iu-unfollow-btn')) {
      const id = target.getAttribute('data-id')!;
      const user = activeUsers.find(u => u.id === id);
      if (user) {
        if (confirm(`Are you sure you want to unfollow @${user.username}?`)) {
          await triggerUnfollow(user, target as HTMLButtonElement);
        }
      }
    }
  });

  // Select All visible handler
  selectAllCheck.addEventListener('change', () => {
    const isChecked = selectAllCheck.checked;
    currentFilteredList.forEach(u => {
      if (isChecked) {
        selectedUserIds.add(u.id);
      } else {
        selectedUserIds.delete(u.id);
      }
    });
    listEl.querySelectorAll('.iu-user-checkbox').forEach(cb => {
      const id = cb.getAttribute('data-id')!;
      (cb as HTMLInputElement).checked = selectedUserIds.has(id);
    });
    updateBulkButton();
  });

  // Bulk Progress Button Actions
  pauseBtn.addEventListener('click', () => {
    isBulkPaused = !isBulkPaused;
    pauseBtn.textContent = isBulkPaused ? 'Resume' : 'Pause';
    pauseBtn.style.background = isBulkPaused ? 'linear-gradient(135deg, #f97316, #ec4899, #7c3aed)' : 'rgba(255, 255, 255, 0.08)';
    pauseBtn.style.color = '#fff';
  });

  cancelBtn.addEventListener('click', () => {
    isBulkCancelled = true;
  });

  // Bulk Unfollow Handler
  bulkUnfollowBtn.addEventListener('click', async () => {
    const idsArray = Array.from(selectedUserIds);
    if (idsArray.length === 0) return;

    if (!confirm(`Are you sure you want to unfollow ${idsArray.length} selected accounts?\nThis will process them sequentially with a safe 2-second delay.`)) {
      return;
    }

    const preventExit = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', preventExit);

    // Initialize state
    isBulkPaused = false;
    isBulkCancelled = false;
    pauseBtn.textContent = 'Pause';
    pauseBtn.style.background = 'rgba(255, 255, 255, 0.08)';
    pauseBtn.style.color = '#fff';

    // Show Progress Banner
    progressBanner.style.display = 'flex';

    // Disable inputs during process
    bulkUnfollowBtn.disabled = true;
    selectAllCheck.disabled = true;
    searchInput.disabled = true;
    nonFollowersCheck.disabled = true;
    followersCheck.disabled = true;
    verifiedCheck.disabled = true;
    layoutBtn.disabled = true;
    exportBtn.disabled = true;
    sortSelect.disabled = true;

    // Disable all checkbox inputs in the cards
    listEl.querySelectorAll('.iu-user-checkbox').forEach(cb => {
      (cb as HTMLInputElement).disabled = true;
    });

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < idsArray.length; i++) {
        if (isBulkCancelled) {
          break;
        }

        // Handle pause loop
        while (isBulkPaused) {
          if (isBulkCancelled) break;
          await new Promise(resolve => setTimeout(resolve, 250));
        }

        if (isBulkCancelled) {
          break;
        }

        const id = idsArray[i];
        const user = activeUsers.find(u => u.id === id);
        if (!user) continue;

        progressText.textContent = `Unfollowing: ${i + 1} / ${idsArray.length} (@${user.username})`;
        
        const cardBtn = listEl.querySelector(`.iu-unfollow-btn[data-id="${id}"]`) as HTMLButtonElement;
        if (cardBtn) {
          cardBtn.disabled = true;
          cardBtn.textContent = '...';
        }

        try {
          const res = await unfollowUser(id, csrfToken);
          
          if (res.ok) {
            successCount++;
            activeUsers = activeUsers.filter(u => u.id !== id);
            selectedUserIds.delete(id);
            
            if (cardBtn) {
              cardBtn.textContent = 'Unfollowed';
              cardBtn.style.background = 'rgba(255,255,255,0.05)';
              cardBtn.style.color = '#ada79d';
            }
          } else {
            if (res.status === 429) {
              isBulkPaused = true;
              pauseBtn.textContent = 'Resume';
              pauseBtn.style.background = 'linear-gradient(135deg, #f97316, #ec4899, #7c3aed)';
              pauseBtn.style.color = '#fff';
              
              if (cardBtn) {
                cardBtn.disabled = false;
                cardBtn.textContent = 'Unfollow';
              }
              
              alert('Instagram rate limit detected (HTTP 429). The bulk unfollow process has been automatically paused. Please wait a few minutes before resuming to avoid account restrictions.');
              i--;
              continue;
            }
            throw new Error('API Fail');
          }
        } catch (err) {
          failCount++;
          if (cardBtn) {
            cardBtn.disabled = false;
            cardBtn.textContent = 'Failed';
          }
        }

        // Save intermediate progress to local cache in case of interruption
        setCachedFollowings(dsUserId, activeUsers);
        updateStatsCounters();

        // Delay to prevent rate limiting, unless it's the last item or cancelled
        if (i < idsArray.length - 1 && !isBulkCancelled) {
          // Generate a random delay between 2.0s and 3.5s to mimic human behavior
          const randomDelay = 2000 + Math.random() * 1500;
          let delayPassed = 0;
          while (delayPassed < randomDelay) {
            if (isBulkCancelled) break;
            while (isBulkPaused) {
              if (isBulkCancelled) break;
              await new Promise(resolve => setTimeout(resolve, 250));
            }
            await new Promise(resolve => setTimeout(resolve, 250));
            delayPassed += 250;
          }
        }
      }
    } finally {
      window.removeEventListener('beforeunload', preventExit);
    }

    // Hide progress banner
    progressBanner.style.display = 'none';

    // Re-enable inputs
    selectAllCheck.disabled = false;
    searchInput.disabled = false;
    nonFollowersCheck.disabled = false;
    followersCheck.disabled = false;
    verifiedCheck.disabled = false;
    layoutBtn.disabled = false;
    exportBtn.disabled = false;
    sortSelect.disabled = false;

    const actionText = isBulkCancelled ? 'Bulk unfollow cancelled.' : 'Bulk unfollow complete.';
    alert(`${actionText}\nSuccessfully unfollowed: ${successCount}\nFailed: ${failCount}`);
    
    updateUIList();
    updateStatsCounters();
    updateBulkButton();
  });

  // Change listeners for checkboxes
  nonFollowersCheck.addEventListener('change', () => {
    showNonFollowers = nonFollowersCheck.checked;
    updateUIList();
  });
  followersCheck.addEventListener('change', () => {
    showFollowers = followersCheck.checked;
    updateUIList();
  });
  verifiedCheck.addEventListener('change', () => {
    showVerified = verifiedCheck.checked;
    updateUIList();
  });

  // Change listener for sorting dropdown
  sortSelect.addEventListener('change', () => {
    updateUIList();
  });

  // Layout Toggle Handler
  layoutBtn.addEventListener('click', () => {
    isGridView = !isGridView;
    layoutBtn.textContent = isGridView ? 'List View' : 'Grid View';
    listEl.classList.toggle('grid-view', isGridView);
  });

  // Live search handler
  searchInput.addEventListener('input', updateUIList);

  // Export handler
  exportBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentFilteredList, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "instagram_filtered_unfollowers.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  updateUIList();
  updateStatsCounters();

  return {
    cancelBulk: () => {
      isBulkCancelled = true;
    }
  };
}
