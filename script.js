document.addEventListener('DOMContentLoaded', () => {
    // Prevent browser from auto-restoring scroll (we handle it manually)
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    /* =========================================
       0. Data Strategy (Static vs API)
       ========================================= */
    const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168');
    const STATIC_DATA_URL = 'data.json';
    const LOCAL_API_URL = 'http://192.168.1.131:1337';

    // Global cache for static data to avoid re-fetching
    let staticDataCache = null;

    // Helper: Get Data (Smart Switching)
    async function getAppData() {
        if (IS_LOCAL) {
            // Local Dev: Fetch keys individually from Strapi directly
            return null; // Return null to signal "Use Direct API Fetch"
        } else {
            // Production: Fetch one big JSON file
            if (staticDataCache) return staticDataCache;
            try {
                const response = await fetch(STATIC_DATA_URL);
                if (!response.ok) throw new Error('Failed to load static data');
                staticDataCache = await response.json();
                return staticDataCache;
            } catch (err) {
                console.error("Static Data Load Error:", err);
                return { projects: [], about: null }; // Fallback
            }
        }
    }

    // Helper: Construct Full Image URL
    function getImageUrl(mediaField) {
        if (!mediaField) return '';
        const img = Array.isArray(mediaField) ? mediaField[0] : mediaField;
        if (!img || !img.url) return '';
        // If it's a full URL (Cloudinary), use it. If relative (Local Strapi), prepend API URL.
        if (img.url.startsWith('http')) return img.url;
        return `${LOCAL_API_URL}${img.url}`;
    }

    // 1. Initial Load Logic
    const isProjectDetailPage = document.body.classList.contains('project-detail-page');
    const isAboutPage = document.body.classList.contains('about-page');
    const isHomePage = !isProjectDetailPage && !isAboutPage;

    // Initialize
    initApp();

    async function initApp() {
        const appData = await getAppData(); // Fetch once if production

        loadLiveStatus(appData);

        if (isHomePage) {
            loadProjectList(appData);
        } else if (isProjectDetailPage) {
            loadProjectDetail(appData);
        } else if (isAboutPage) {
            loadAboutPage(appData);
        }
    }

    setupGlobalNav();

    /* =========================================
       2. Data Loading Functions
       ========================================= */

    async function loadLiveStatus(appData) {
        let cvData;

        if (appData) {
            // Static Mode
            cvData = appData.about?.cv;
        } else {
            // API Mode
            const data = await fetchAPI('about-page?populate[cv][populate]=*');
            cvData = data?.cv;
        }

        if (!cvData) return;

        let activeEntry = null;

        // Find first entry that is isLive=true AND has valid dates
        outerLoop:
        for (const section of cvData) {
            if (section.entries) {
                for (const entry of section.entries) {
                    if (entry.isLive === true) {
                        const testSettings = {
                            isActive: true,
                            startDate: entry.liveStartDate,
                            endDate: entry.liveEndDate
                        };

                        if (isNewsActive(testSettings)) {
                            activeEntry = entry;
                            break outerLoop;
                        }
                    }
                }
            }
        }

        if (activeEntry) {
            const newsSettings = {
                isActive: true,
                startDate: activeEntry.liveStartDate,
                endDate: activeEntry.liveEndDate,
                label: activeEntry.liveLabel || "Live Exhibition",
                link: 'about.html#live-news-target',
                target: '_self'
            };
            renderLiveNews(newsSettings, true);
        } else {
            renderLiveNews(null, false);
        }
    }

    async function loadProjectList(appData) {
        const container = document.querySelector('.container-projects');
        if (!container) return;

        let projects = [];
        if (appData) {
            projects = appData.projects || [];
        } else {
            projects = await fetchAPI('projects?populate=thumbnail&sort=year:desc');
        }

        if (!projects || projects.length === 0) {
            container.innerHTML = '<p>No projects found.</p>';
            return;
        }

        let html = '';
        projects.forEach(project => {
            const thumbUrl = getImageUrl(project.thumbnail);
            const href = `project-detail.html?project=${project.slug}`;

            const isVideo = project.thumbnail?.mime?.startsWith('video');
            let mediaHtml = '';
            if (isVideo) {
                mediaHtml = `<video src="${thumbUrl}" muted loop autoplay playsinline></video>`;
            } else {
                mediaHtml = `<img src="${thumbUrl}" alt="${project.title}">`;
            }

            html += `
            <a href="${href}" class="project">
                ${mediaHtml}
                <h3>${project.title}, <span>${project.year}</span></h3>
            </a>`;
        });

        container.innerHTML = html;
        attachProjectListeners();

        // Restore Scroll Position if returning from detail page
        const savedScroll = sessionStorage.getItem('scrollPosition');
        if (savedScroll) {
            // Slight delay to ensure layout and widths are calculated
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedScroll, 10));
                sessionStorage.removeItem('scrollPosition');
            }, 10);
        }
    }

    async function loadProjectDetail(appData) {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get('project');

        if (!slug) return; // TODO: handle error

        let project = null;

        if (appData) {
            // Static Filter
            project = appData.projects.find(p => p.slug === slug);
        } else {
            // API Fetch
            const query = `projects?filters[slug][$eq]=${slug}&populate[content][populate]=*`;
            const data = await fetchAPI(query);
            project = data ? data[0] : null;
        }

        if (!project) {
            document.querySelector('.project-container').innerHTML = '<p>Project not found.</p>';
            return;
        }

        renderProjectDetail(project);
    }

    async function loadAboutPage(appData) {
        let aboutData = null;
        if (appData) {
            aboutData = appData.about;
        } else {
            aboutData = await fetchAPI('about-page?populate[cv][populate]=*');
        }

        if (aboutData) renderAboutPage(aboutData);
    }

    // Legacy Local API Helper (Keep for Dev)
    async function fetchAPI(endpoint) {
        try {
            const response = await fetch(`${LOCAL_API_URL}/api/${endpoint}`);
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const json = await response.json();
            return json.data;
        } catch (error) {
            console.error("Fetch API Error:", error);
            return null;
        }
    }



    /* =========================================
       3. Helper Logic
       ========================================= */

    function isNewsActive(newsSettings) {
        if (!newsSettings.isActive) return false;
        if (!newsSettings.startDate || !newsSettings.endDate) return true;

        const now = new Date();
        const start = new Date(newsSettings.startDate);
        const end = new Date(newsSettings.endDate);
        end.setHours(23, 59, 59, 999);

        return now >= start && now <= end;
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    /* =========================================
       4. Render Functions
       ========================================= */

    function renderProjectDetail(data) {
        const container = document.querySelector('.project-container');
        if (!container) return;

        const titleHTML = `<h2 class="project-title">${data.title}, <span>${data.year}</span></h2>`;
        let imagesHTML = '<div class="project-images">';
        let thumbnailsHTML = '<div class="thumbnail-grid">';

        if (data.content) {
            data.content.forEach((item, index) => {
                const id = `project-item-${index + 1}`;
                const componentType = item.__component;

                // Construct Main Image/Video
                if (componentType === 'content.video-slide') {
                    if (item.vimeoUrl) {
                        // Vimeo Logic (Controls Enabled)
                        const vimeoIdMatch = item.vimeoUrl.match(/vimeo\.com\/(\d+)/);
                        const vimeoId = vimeoIdMatch ? vimeoIdMatch[1] : null;
                        // Removed background=1 to show controls. kept autoplay/loop. removed muted=1 so user can hear if they want (but autoplay might block unmuted).
                        // Actually, generic autoplay usually requires mute. Let's try autoplay=1&muted=1 but allow controls.
                        const vimeoSrc = vimeoId ? `https://player.vimeo.com/video/${vimeoId}?autoplay=1&loop=1&autopause=0&muted=1&title=0&byline=0&portrait=0` : '';

                        imagesHTML += `
                        <figure class="video-container vimeo-container">
                             <iframe id="${id}" src="${vimeoSrc}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" style="width:100%; height:100%;"></iframe>
                             ${item.caption ? `<figcaption>${item.caption}</figcaption>` : ''}
                        </figure>`;

                        thumbnailsHTML += `
                        <div class="thumbnail-wrapper">
                             <div class="vimeo-thumb-placeholder" data-target="${id}">Vimeo</div>
                             <span class="thumbnail-number">${index + 1}</span>
                        </div>`;

                    } else {
                        // Standard HTML5 Video Logic
                        const vidUrl = getImageUrl(item.video);
                        imagesHTML += `
                            <figure class="video-container">
                                <video id="${id}" src="${vidUrl}" playsinline autoplay muted loop></video>
                                <div class="video-controls">
                                    <button class="play-pause-btn">Stop</button>
                                    <button class="mute-btn">Unmute</button>
                                    <input type="range" class="video-timeline" value="0" min="0" step="0.1">
                                    <span class="video-duration">0:00 / 0:00</span>
                                    <button class="fullscreen-btn" aria-label="Fullscreen">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"></path>
                                        </svg>
                                    </button>
                                </div>
                                ${item.caption ? `<figcaption>${item.caption}</figcaption>` : ''} 
                            </figure>`;

                        thumbnailsHTML += `
                            <div class="thumbnail-wrapper">
                                <video src="${vidUrl}" muted loop autoplay playsinline data-target="${id}"></video>
                                <span class="thumbnail-number">${index + 1}</span>
                            </div>`;
                    }

                } else {
                    const imgUrl = getImageUrl(item.image);
                    imagesHTML += `
                        <figure>
                            <img id="${id}" src="${imgUrl}" alt="${data.title} detail">
                            ${item.caption ? `<figcaption>${item.caption}</figcaption>` : ''}
                        </figure>`;

                    thumbnailsHTML += `
                        <div class="thumbnail-wrapper">
                            <img src="${imgUrl}" alt="Thumbnail ${index + 1}" data-target="${id}">
                            <span class="thumbnail-number">${index + 1}</span>
                        </div>`;
                }
            });
        }
        imagesHTML += '</div>';
        thumbnailsHTML += '</div>';

        // Check for videos to update label
        const hasVideo = data.content && data.content.some(c => c.__component === 'content.video-slide');
        const libraryLabel = hasVideo ? 'Image and Video library' : 'Image library';

        const infoHTML = `
            <div class="project-info-content">
                <div class="project-description">
                    <span>Description</span>
                    <p>${parseMarkdown(data.description)}</p>
                </div>
                <div class="project-material">
                    <span>Material</span>
                    <p>${data.material || ''}</p>
                </div>
                <div class="project-thumbnails">
                    <span>${libraryLabel}</span>
                    ${thumbnailsHTML}
                </div>
            </div>`;

        container.innerHTML = titleHTML + imagesHTML + infoHTML;

        // Setup Interactions after Render
        setTimeout(() => {
            generateCaptionList();
            attachVideoControls();
            attachThumbnailListeners();
            attachTitleScrollListener();
            attachInfoBtnListener();
        }, 50);
    }



    function parseMarkdown(text) {
        if (!text) return '';
        return text
            // Bold (**text**)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic (*text* or _text_)
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            // Links ([text](url))
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
            // Line breaks
            .replace(/\n/g, '<br>');
    }

    function renderAboutPage(data) {
        const aboutContent = document.querySelector('.about-content');
        if (!aboutContent) return;

        // Inject fixed heading container
        let fixedHeading = document.getElementById('fixed-cv-heading');
        if (!fixedHeading) {
            fixedHeading = document.createElement('div');
            fixedHeading.id = 'fixed-cv-heading';
            document.body.appendChild(fixedHeading);
        }

        const bioHTML = `
            <span class="h1-spacer"></span>
            <span class="about-text">${parseMarkdown(data.bio)}</span>
        `;
        let cvHTML = '<div class="cv-container">';
        if (data.cv) {
            data.cv.forEach((section, idx) => {
                let entriesHTML = '';
                if (section.entries) {
                    section.entries.forEach(entry => {
                        let extraDetails = '';
                        if (entry.details) {
                            extraDetails = `<span class="cv-info details">${parseMarkdown(entry.details)}</span>`;
                        }

                        let linkHTML = '';
                        if (entry.linkUrl) {
                            linkHTML = `<a href="${entry.linkUrl}" target="${entry.linkTarget || '_blank'}" class="cv-visit-link">${entry.linkText || 'Link'}</a>`;
                        }

                        let titleContent = entry.title;
                        let entryIdAttr = '';
                        let displayYear = entry.year;

                        if (entry.isLive === true) {
                            // Check if it's actually active based on dates
                            const newsSettings = {
                                isActive: true,
                                startDate: entry.liveStartDate,
                                endDate: entry.liveEndDate
                            };

                            if (isNewsActive(newsSettings)) {
                                titleContent = `<span class="breathing-dot cv-dot-spacer"></span>${entry.title}`;
                                entryIdAttr = 'id="live-news-target"';
                                displayYear = 'Currently';
                            }
                        }

                        entriesHTML += `
                        <div class="cv-entry" ${entryIdAttr}>
                            <span class="cv-year">${displayYear}</span>
                            <span class="cv-title">${titleContent}</span>
                            <span class="cv-info">${entry.info || ''}</span>
                            ${extraDetails}
                            ${linkHTML}
                        </div>`;
                    });
                }
                cvHTML += `
                <div class="cv-section" data-heading="${section.heading}">
                    <h2 class="cv-heading">${section.heading}</h2>
                    ${entriesHTML}
                </div>`;
            });
        }
        cvHTML += '</div>';

        aboutContent.innerHTML = bioHTML + cvHTML;

        setupAboutSpacer();
        window.dispatchEvent(new Event('resize'));

        // Setup Sticky Heading Observer
        const observerOptions = {
            root: null,
            rootMargin: '-50% 0px -50% 0px', // Exact center line trigger
            threshold: 0
        };

        const headingObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const headingText = entry.target.getAttribute('data-heading');

                if (entry.isIntersecting) {
                    // Start of section hits center -> Fade In new heading
                    if (fixedHeading.textContent !== headingText) {
                        fixedHeading.style.opacity = '0';
                        setTimeout(() => {
                            fixedHeading.textContent = headingText;
                            fixedHeading.style.opacity = '1';
                        }, 200);
                    } else {
                        // Already correct text, just ensure visible
                        fixedHeading.style.opacity = '1';
                    }
                    fixedHeading.classList.add('visible');
                } else {
                    // End of section leaves center -> Fade Out if it's the active one
                    if (fixedHeading.textContent === headingText) {
                        fixedHeading.classList.remove('visible');
                        fixedHeading.style.opacity = '0';
                    }
                }
            });
        }, observerOptions);

        document.querySelectorAll('.cv-section').forEach(section => {
            headingObserver.observe(section);
        });

        // Handle Hash Anchor Scrolling (Async)
        setTimeout(() => {
            if (window.location.hash) {
                const targetWrapper = document.querySelector(window.location.hash);
                if (targetWrapper) {
                    // Try to scroll the title specifically to align with fixed heading
                    const titleTarget = targetWrapper.querySelector('.cv-title');
                    const elementToScroll = titleTarget || targetWrapper;

                    elementToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 100);
    }

    function renderLiveNews(data, activeStatus) {
        const indicator = document.querySelector('.live-exhibition-indicator');
        if (!indicator) return;

        // Determine if we are on the Home Page (Gallery/List)
        const isProjectDetailPage = document.body.classList.contains('project-detail-page');
        const isAboutPage = document.body.classList.contains('about-page');
        const isHomePage = !isProjectDetailPage && !isAboutPage;

        // If not active OR not on home page, hide it
        if (!activeStatus || !isHomePage) {
            indicator.style.display = 'none';
            return;
        }

        const dotHTML = `<div class="breathing-dot"></div>`;
        const linkHTML = `<a href="${data.link}" target="${data.target}">${data.label}</a>`;

        // Initial clean render to measure
        indicator.innerHTML = `<div class="marquee-content">${dotHTML}${linkHTML}</div>`;
        indicator.style.display = 'flex';
        indicator.classList.remove('marquee-active'); // Reset

        // Measure width vs viewport
        const content = indicator.querySelector('.marquee-content');
        const availableWidth = window.innerWidth * 0.9; // 90% of screen width safety

        if (content.offsetWidth > availableWidth) {
            // Turn on Marquee
            indicator.classList.add('marquee-active');
            // Duplicate content (4 times to ensure smooth fill on wide screens)
            content.innerHTML = `${dotHTML}${linkHTML}${dotHTML}${linkHTML}${dotHTML}${linkHTML}${dotHTML}${linkHTML}`;
        }
    }

    /* =========================================
       5. Interaction Logic
       ========================================= */

    function setupGlobalNav() {
        const projectsLink = document.querySelector('.nav-wrapper a[href="index.html"]');
        const projectsContainer = document.querySelector('.container-projects');
        const yearSpan = document.getElementById('copyright-year');
        if (yearSpan) yearSpan.textContent = new Date().getFullYear();

        if (projectsLink && projectsContainer) {
            projectsLink.addEventListener('click', (e) => {
                // If on Home Page, toggle view. Else, let default nav happen.
                if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || document.querySelector('.container-projects')) {
                    e.preventDefault();
                    projectsContainer.style.opacity = '0';
                    setTimeout(() => {
                        projectsContainer.classList.add('switching');
                        projectsContainer.classList.toggle('list-view');
                        projectsLink.textContent = projectsContainer.classList.contains('list-view') ? 'Gallery' : 'Index';
                        void projectsContainer.offsetWidth;
                        projectsContainer.classList.remove('switching');
                        projectsContainer.style.opacity = '1';
                    }, 600);
                }
            });
        }
    }

    function attachProjectListeners() {
        const projects = document.querySelectorAll('.project');
        const projectsContainer = document.querySelector('.container-projects');

        projects.forEach(project => {
            // Save scroll position on click
            project.addEventListener('click', () => {
                sessionStorage.setItem('scrollPosition', window.scrollY);
            });

            project.addEventListener('mouseenter', () => {
                if (projectsContainer && projectsContainer.classList.contains('list-view')) {
                    const img = project.querySelector('img');
                    const video = project.querySelector('video');
                    if (img) img.classList.add('show-image');
                    if (video) {
                        video.classList.add('show-image');
                        video.currentTime = 0;
                        video.muted = true;
                        video.play().catch(e => { });
                    }
                }
            });
            project.addEventListener('mouseleave', () => {
                if (projectsContainer && projectsContainer.classList.contains('list-view')) {
                    const img = project.querySelector('img');
                    const video = project.querySelector('video');
                    if (img) img.classList.remove('show-image');
                    if (video) {
                        video.classList.remove('show-image');
                        video.pause();
                        video.currentTime = 0;
                    }
                }
            });
        });

        // Mobile Scroll Observver
        if (window.matchMedia("(max-width: 768px)").matches) {
            const projectObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('mobile-active');
                        if (projectsContainer && projectsContainer.classList.contains('list-view')) {
                            // Trigger media play if needed
                            const video = entry.target.querySelector('video');
                            if (video) video.play().catch(e => { });
                        }
                    } else {
                        entry.target.classList.remove('mobile-active');
                        const video = entry.target.querySelector('video');
                        if (video) video.pause();
                    }
                });
            }, { rootMargin: '-25% 0px -25% 0px', threshold: 0 });

            projects.forEach(el => projectObserver.observe(el));
        }
    }

    function attachVideoControls() {
        const videoContainers = document.querySelectorAll('.video-container');
        videoContainers.forEach(container => {
            const video = container.querySelector('video');
            const playBtn = container.querySelector('.play-pause-btn');
            const muteBtn = container.querySelector('.mute-btn');
            const fullscreenBtn = container.querySelector('.fullscreen-btn');
            const timeline = container.querySelector('.video-timeline');
            const durationDisplay = container.querySelector('.video-duration');

            if (!video || !playBtn || !muteBtn || !timeline || !durationDisplay) return;

            // Sync button state on native play/pause (e.g. from fullscreen)
            video.addEventListener('play', () => {
                playBtn.textContent = 'Stop';
            });
            video.addEventListener('pause', () => {
                playBtn.textContent = 'Play';
            });

            playBtn.addEventListener('click', () => {
                if (video.paused) { video.play(); }
                else { video.pause(); }
            });

            muteBtn.addEventListener('click', () => {
                video.muted = !video.muted;
                muteBtn.textContent = video.muted ? 'Unmute' : 'Mute';
            });

            if (fullscreenBtn) {
                fullscreenBtn.addEventListener('click', () => {
                    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
                    if (!isFullscreen) {
                        if (container.requestFullscreen) container.requestFullscreen();
                        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
                    } else {
                        if (document.exitFullscreen) document.exitFullscreen();
                        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                    }
                });
            }

            const handleFullscreenChange = () => {
                const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
                if (isFullscreen) {
                    video.controls = true; // Enable native controls
                    video.classList.add('is-fullscreen');
                    fullscreenBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v5H3m13-5v5h5M3 16h5v5m13-5h-5v5"></path></svg>`;
                } else {
                    video.controls = false; // Disable native controls
                    video.classList.remove('is-fullscreen');
                    fullscreenBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"></path></svg>`;
                }
            };

            container.addEventListener('fullscreenchange', handleFullscreenChange);
            container.addEventListener('webkitfullscreenchange', handleFullscreenChange);

            const updateTimelineMax = () => {
                if (video.duration) {
                    timeline.max = video.duration;
                    updateDurationDisplay();
                }
            };
            video.addEventListener('loadedmetadata', updateTimelineMax);
            video.addEventListener('timeupdate', () => {
                timeline.value = video.currentTime;
                updateDurationDisplay();
            });
            timeline.addEventListener('input', () => {
                video.currentTime = timeline.value;
            });

            function updateDurationDisplay() {
                durationDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration || 0)}`;
            }
        });
    }

    function attachThumbnailListeners() {
        const thumbnails = document.querySelectorAll('.project-thumbnails img, .project-thumbnails video, .project-thumbnails .vimeo-thumb-placeholder');
        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', () => {
                const targetId = thumb.getAttribute('data-target');
                const targetImg = document.getElementById(targetId);
                if (targetImg) {
                    targetImg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        });
    }

    function attachTitleScrollListener() {
        const projectDetailTitle = document.querySelector('.project-title');
        if (projectDetailTitle) {
            projectDetailTitle.style.cursor = 'pointer';
            projectDetailTitle.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    function attachInfoBtnListener() {
        const infoBtn = document.getElementById('info-btn');
        const projectInfoContent = document.querySelector('.project-info-content');
        if (infoBtn && projectInfoContent) {
            infoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Scroll with offset (5rem)
                const remSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
                const offset = 5 * remSize;
                const elementPosition = projectInfoContent.getBoundingClientRect().top + window.scrollY;
                const offsetPosition = elementPosition - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            });
        }
    }

    function setupAboutSpacer() {
        const h1Link = document.querySelector('h1 a');
        const aboutContent = document.querySelector('.about-content');
        const h1Spacer = document.querySelector('.h1-spacer');

        const updateSpacer = () => {
            if (h1Link && aboutContent) {
                const halfWidth = h1Link.offsetWidth / 2;
                aboutContent.style.setProperty('--h1-half-width', `${halfWidth}px`);
                if (h1Spacer) {
                    const fontSize = parseFloat(window.getComputedStyle(h1Link).fontSize);
                    h1Spacer.style.height = `${fontSize * 1.15}px`;
                }
            }
        };
        updateSpacer();
        window.addEventListener('resize', updateSpacer);
    }

    function generateCaptionList() {
        const figures = document.querySelectorAll('.project-images figure');
        const infoContent = document.querySelector('.project-info-content');

        // Prevent duplicate list if re-running
        const existingList = document.querySelector('.project-caption-list');
        if (existingList) existingList.remove();

        if (!figures.length || !infoContent) return;

        const list = document.createElement('ol');
        list.classList.add('project-caption-list');
        let hasCaptions = false;
        let count = 0;
        const captionItems = [];

        figures.forEach((figure, index) => {
            const caption = figure.querySelector('figcaption');
            const thumbnailWrappers = document.querySelectorAll('.thumbnail-wrapper');
            const thumbnailNumber = thumbnailWrappers[index] ? thumbnailWrappers[index].querySelector('.thumbnail-number') : null;

            if (caption && caption.textContent.trim() !== "") {
                hasCaptions = true;
                count++;
                const li = document.createElement('li');
                li.innerHTML = `<span class="caption-number">${count}.</span><span class="caption-text">${caption.textContent}</span>`;
                list.appendChild(li);
                captionItems.push(li);
                if (thumbnailNumber) { thumbnailNumber.textContent = count; thumbnailNumber.style.display = 'block'; }
            } else {
                captionItems.push(null);
                if (thumbnailNumber) { thumbnailNumber.style.display = 'none'; }
            }
        });

        if (hasCaptions) {
            infoContent.appendChild(list);
            const thumbnails = document.querySelectorAll('.thumbnail-wrapper');
            thumbnails.forEach((wrapper, index) => {
                const img = wrapper.querySelector('img') || wrapper.querySelector('video') || wrapper.querySelector('.vimeo-thumb-placeholder');
                if (img && captionItems[index]) {
                    img.addEventListener('mouseenter', () => captionItems[index].classList.add('caption-highlight'));
                    img.addEventListener('mouseleave', () => captionItems[index].classList.remove('caption-highlight'));
                }
            });
        }
    }

});
