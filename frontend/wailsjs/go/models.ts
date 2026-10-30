export namespace audio {
	
	export class State {
	    trackId: string;
	    position: number;
	    duration: number;
	    paused: boolean;
	    speed: number;
	    shuffle: boolean;
	    repeat: string;
	    hasTrack: boolean;
	    queueSize: number;
	
	    static createFrom(source: any = {}) {
	        return new State(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.trackId = source["trackId"];
	        this.position = source["position"];
	        this.duration = source["duration"];
	        this.paused = source["paused"];
	        this.speed = source["speed"];
	        this.shuffle = source["shuffle"];
	        this.repeat = source["repeat"];
	        this.hasTrack = source["hasTrack"];
	        this.queueSize = source["queueSize"];
	    }
	}

}

export namespace core {
	
	export class NowPlaying {
	    track: library.Track;
	    palette: palette.Palette;
	    hasCover: boolean;
	
	    static createFrom(source: any = {}) {
	        return new NowPlaying(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.track = this.convertValues(source["track"], library.Track);
	        this.palette = this.convertValues(source["palette"], palette.Palette);
	        this.hasCover = source["hasCover"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class InitState {
	    settings: settings.Settings;
	    tracks: library.Track[];
	    playlists: playlist.Playlist[];
	    presets: Record<string, Array<number>>;
	    bands: number[];
	    audioError: string;
	    now?: NowPlaying;
	    state: audio.State;
	
	    static createFrom(source: any = {}) {
	        return new InitState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.settings = this.convertValues(source["settings"], settings.Settings);
	        this.tracks = this.convertValues(source["tracks"], library.Track);
	        this.playlists = this.convertValues(source["playlists"], playlist.Playlist);
	        this.presets = source["presets"];
	        this.bands = source["bands"];
	        this.audioError = source["audioError"];
	        this.now = this.convertValues(source["now"], NowPlaying);
	        this.state = this.convertValues(source["state"], audio.State);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace library {
	
	export class Track {
	    id: string;
	    path: string;
	    title: string;
	    artist: string;
	    albumArtist: string;
	    album: string;
	    discNo: number;
	    trackNo: number;
	    date: string;
	    duration: number;
	    modTime: number;
	    size: number;
	    tagsV: number;
	    group: string;
	
	    static createFrom(source: any = {}) {
	        return new Track(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.path = source["path"];
	        this.title = source["title"];
	        this.artist = source["artist"];
	        this.albumArtist = source["albumArtist"];
	        this.album = source["album"];
	        this.discNo = source["discNo"];
	        this.trackNo = source["trackNo"];
	        this.date = source["date"];
	        this.duration = source["duration"];
	        this.modTime = source["modTime"];
	        this.size = source["size"];
	        this.tagsV = source["tagsV"];
	        this.group = source["group"];
	    }
	}

}

export namespace palette {
	
	export class Palette {
	    bg1: string;
	    bg2: string;
	    accent: string;
	    text: string;
	
	    static createFrom(source: any = {}) {
	        return new Palette(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bg1 = source["bg1"];
	        this.bg2 = source["bg2"];
	        this.accent = source["accent"];
	        this.text = source["text"];
	    }
	}

}

export namespace playlist {
	
	export class Playlist {
	    id: string;
	    name: string;
	    trackIds: string[];
	    created: number;
	
	    static createFrom(source: any = {}) {
	        return new Playlist(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.trackIds = source["trackIds"];
	        this.created = source["created"];
	    }
	}

}

export namespace settings {
	
	export class Settings {
	    musicDir: string;
	    volume: number;
	    eq: number[];
	    eqPreset: string;
	    speed: number;
	    reverbWet: number;
	    reverbRoom: number;
	    crossfade: number;
	    crossfadeOnSkip: boolean;
	    shuffle: boolean;
	    repeat: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.musicDir = source["musicDir"];
	        this.volume = source["volume"];
	        this.eq = source["eq"];
	        this.eqPreset = source["eqPreset"];
	        this.speed = source["speed"];
	        this.reverbWet = source["reverbWet"];
	        this.reverbRoom = source["reverbRoom"];
	        this.crossfade = source["crossfade"];
	        this.crossfadeOnSkip = source["crossfadeOnSkip"];
	        this.shuffle = source["shuffle"];
	        this.repeat = source["repeat"];
	    }
	}

}

