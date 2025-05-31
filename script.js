// Shega TV Streaming Platform
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Telegram WebApp if available
    let tgWebApp = null;
    if (window.Telegram && window.Telegram.WebApp) {
        tgWebApp = Telegram.WebApp;
        tgWebApp.expand();
        document.body.classList.add('tg-app');
        
        // Set theme based on Telegram theme
        if (tgWebApp.colorScheme === 'dark') {
            setTheme('dark');
        } else {
            setTheme('light');
        }
        
        // Watch for theme changes
        tgWebApp.onEvent('themeChanged', () => {
            setTheme(tgWebApp.colorScheme);
        });
    } else {
        // Regular browser - check localStorage for theme
        const savedTheme = localStorage.getItem('shega-tv-theme') || 'dark';
        setTheme(savedTheme);
    }
    
    // Channel configuration
    const channels = {
        channel1: {
            name: "EBS TV HD",
            url: "https://bozztv.com/ebstv/ebstv/index.m3u8", // Replace with actual URL
            qualities: [
                { name: "HD", url: "https://bozztv.com/ebstv/ebstv/index.m3u8" },
                { name: "SD", url: "https://bozztv.com/ebstv/ebstv/index.m3u8" }
            ]
        },
        channel2: {
            name: "EBS Cinema",
            url: "https://bozztv.com/ebstv/ebscinema/index.m3u8", // Replace with actual URL
            qualities: [
                { name: "HD", url: "https://bozztv.com/ebstv/ebscinema/index.m3u8" },
                { name: "SD", url: "https://bozztv.com/ebstv/ebscinema/index.m3u8" }
            ]
        },
        channel3: {
            name: "EBS Musika",
            url: "https://bozztv.com/ebstv/ebsmusika/index.m3u8", // Replace with actual URL
            qualities: [
                { name: "HD", url: "https://bozztv.com/ebstv/ebsmusika/index.m3u8" },
                { name: "SD", url: "https://bozztv.com/ebstv/ebsmusika/index.m3u8" }
            ]
        }
    };
    
    // Player elements
    const player = document.getElementById('main-player');
    const currentChannelName = document.getElementById('current-channel-name');
    const qualitySelect = document.getElementById('quality-select');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const muteBtn = document.getElementById('mute-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const loadingSpinner = document.getElementById('loading-spinner');
    const themeToggle = document.getElementById('theme-toggle');
    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    const channelCards = document.querySelectorAll('.channel-card');
    
    let hls = null;
    let currentChannel = null;
    
    // Initialize HLS.js if supported
    function initHls() {
        if (window.Hls) {
            return new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 600,
                maxBufferSize: 60 * 1000 * 1000,
                maxBufferHole: 0.5,
                lowLatencyMode: false,
                enableWorker: true,
                startLevel: -1, // Auto quality
                abrEwmaDefaultEstimate: 500000, // 500kbps initial estimate
                abrBandWidthFactor: 0.95,
                abrBandWidthUpFactor: 0.7,
                abrEwmaSlowLive: 5.0,
                abrEwmaFastLive: 1.0,
                abrEwmaSlowVoD: 5.0,
                abrEwmaFastVoD: 1.0
            });
        }
        return null;
    }
    
    // Load a channel
    function loadChannel(channelId) {
        if (!channels[channelId]) return;
        
        currentChannel = channelId;
        const channel = channels[channelId];
        currentChannelName.textContent = channel.name;
        
        // Show loading spinner
        loadingSpinner.classList.add('active');
        
        // Stop any existing playback
        if (hls) {
            hls.destroy();
        }
        
        player.pause();
        
        // Setup quality selector
        setupQualitySelector(channel);
        
        // Check for HLS support
        if (Hls.isSupported()) {
            hls = initHls();
            hls.loadSource(channel.url);
            hls.attachMedia(player);
            
            hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
                console.log('Manifest loaded, found ' + data.levels.length + ' quality levels');
                loadingSpinner.classList.remove('active');
                player.play().catch(e => {
                    console.log('Autoplay prevented:', e);
                    loadingSpinner.classList.remove('active');
                });
            });
            
            hls.on(Hls.Events.ERROR, function(event, data) {
                console.error('HLS Error:', data);
                if (data.fatal) {
                    switch(data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error('Network error, trying to recover');
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error('Media error, trying to recover');
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error('Fatal error, cannot recover');
                            loadingSpinner.classList.remove('active');
                            // Fallback to native playback
                            fallbackToNativePlayback(channel.url);
                            break;
                    }
                }
            });
        } else if (player.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            player.src = channel.url;
            player.addEventListener('loadedmetadata', function() {
                loadingSpinner.classList.remove('active');
                player.play().catch(e => {
                    console.log('Autoplay prevented:', e);
                    loadingSpinner.classList.remove('active');
                });
            });
        } else {
            console.error('HLS not supported');
            loadingSpinner.classList.remove('active');
            alert('Your browser does not support HLS streaming');
        }
    }
    
    // Fallback to native playback
    function fallbackToNativePlayback(url) {
        player.src = url;
        player.addEventListener('error', function() {
            loadingSpinner.classList.remove('active');
            alert('Error loading stream');
        });
        player.play().catch(e => {
            console.log('Autoplay prevented:', e);
            loadingSpinner.classList.remove('active');
        });
    }
    
    // Setup quality selector
    function setupQualitySelector(channel) {
        // Clear existing options
        while (qualitySelect.options.length > 1) {
            qualitySelect.remove(1);
        }
        
        // Add quality options if available
        if (channel.qualities && channel.qualities.length > 0) {
            channel.qualities.forEach((quality, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.text = quality.name;
                qualitySelect.add(option);
            });
        }
    }
    
    // Change quality
    qualitySelect.addEventListener('change', function() {
        if (!hls || !currentChannel) return;
        
        const selectedQuality = this.value;
        
        if (selectedQuality === 'auto') {
            hls.currentLevel = -1; // Auto
        } else {
            const qualityIndex = parseInt(selectedQuality);
            hls.currentLevel = qualityIndex;
        }
    });
    
    // Play/pause button
    playPauseBtn.addEventListener('click', function() {
        if (player.paused) {
            player.play();
        } else {
            player.pause();
        }
    });
    
    // Update play/pause button state
    player.addEventListener('play', function() {
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    });
    
    player.addEventListener('pause', function() {
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    });
    
    // Mute button
    muteBtn.addEventListener('click', function() {
        player.muted = !player.muted;
        updateMuteButton();
    });
    
    function updateMuteButton() {
        if (player.muted) {
            muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            volumeSlider.value = 0;
        } else {
            muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            volumeSlider.value = player.volume;
        }
    }
    
    // Volume slider
    volumeSlider.addEventListener('input', function() {
        player.volume = this.value;
        player.muted = (this.value == 0);
        updateMuteButton();
    });
    
    player.addEventListener('volumechange', updateMuteButton);
    
    // Theme toggle
    themeToggle.addEventListener('click', function() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        
        if (!tgWebApp) {
            localStorage.setItem('shega-tv-theme', newTheme);
        }
    });
    
    function setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        
        if (theme === 'light') {
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        } else {
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }
    
    // Fullscreen toggle
    fullscreenToggle.addEventListener('click', function() {
        if (!document.fullscreenElement) {
            player.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });
    
    // Update fullscreen button based on state
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    document.addEventListener('mozfullscreenchange', updateFullscreenButton);
    
    function updateFullscreenButton() {
        if (document.fullscreenElement || 
            document.webkitFullscreenElement || 
            document.mozFullScreenElement) {
            fullscreenToggle.innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            fullscreenToggle.innerHTML = '<i class="fas fa-expand"></i>';
        }
    }
    
    // Channel cards
    channelCards.forEach(card => {
        card.addEventListener('click', function() {
            const channelId = this.getAttribute('data-channel');
            loadChannel(channelId);
            
            // Scroll to player
            document.querySelector('.player-container').scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
    
    // Load HLS.js library if not already loaded
    if (!window.Hls) {
        const hlsScript = document.createElement('script');
        hlsScript.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
        hlsScript.onload = function() {
            // Load first channel by default
            loadChannel('channel1');
        };
        document.head.appendChild(hlsScript);
    } else {
        // Load first channel by default
        loadChannel('channel1');
    }
    
    // Handle beforeunload to clean up HLS
    window.addEventListener('beforeunload', function() {
        if (hls) {
            hls.destroy();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Space to play/pause
        if (e.code === 'Space' && e.target === document.body) {
            e.preventDefault();
            if (player.paused) {
                player.play();
            } else {
                player.pause();
            }
        }
        
        // M to mute
        if (e.code === 'KeyM' && e.target === document.body) {
            e.preventDefault();
            player.muted = !player.muted;
            updateMuteButton();
        }
        
        // F for fullscreen
        if (e.code === 'KeyF' && e.target === document.body) {
            e.preventDefault();
            fullscreenToggle.click();
        }
        
        // Arrow keys for volume
        if (e.code === 'ArrowUp' && e.target === document.body) {
            e.preventDefault();
            player.volume = Math.min(1, player.volume + 0.1);
            volumeSlider.value = player.volume;
            if (player.muted && player.volume > 0) {
                player.muted = false;
                updateMuteButton();
            }
        }
        
        if (e.code === 'ArrowDown' && e.target === document.body) {
            e.preventDefault();
            player.volume = Math.max(0, player.volume - 0.1);
            volumeSlider.value = player.volume;
            if (player.volume === 0) {
                player.muted = true;
                updateMuteButton();
            }
        }
    });
});