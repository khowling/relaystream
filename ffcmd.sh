VP9_LIVE_PARAMS="-speed 6 -tile-columns 4 -frame-parallel 1 -threads 8 -static-thresh 0 -max-intra-r
ate 300 -deadline realtime -lag-in-frames 0 -error-resilient 1"

export CHUNK_START_IDX=1
export VIDEO_NAME=vcam
export CHUNK_VIDEO_NAME=${VIDEO_NAME}_v
export CHUNK_AUDIO_NAME=${VIDEO_NAME}_a
export SERVER=http://localhost:6000/dash/$(date +%s)
export SERVER_DASH=http://localhost:6000/wcam/dash/$(date +%s)
export SERVER_HLS=http://localhost:6000/wcam/hls/$(date +%s)

## DASH
ffmpeg -f v4l2 -i /dev/video0 -f alsa -ar 44100 -ac 2 -i plughw:CARD=HD3000,DEV=0 -map 0:0 -pix_fmt
yuv420p -c:v libvpx-vp9 -s 1280x720 -keyint_min 60 -g 60 ${VP9_LIVE_PARAMS} -b:v 3000k -f webm_chunk
 -header ${SERVER_DASH}/${CHUNK_VIDEO_NAME}.hdr -chunk_start_index ${CHUNK_START_IDX} ${SERVER_DASH}
/${CHUNK_VIDEO_NAME}_%d.chk -map 1:0 -c:a libvorbis -b:a 128k -ar 44100 -f webm_chunk -audio_chunk_d
uration 2000 -header ${SERVER_DASH}/${CHUNK_AUDIO_NAME}.hdr -chunk_start_index 1 ${SERVER_DASH}/${CH
UNK_AUDIO_NAME}_%d.chk

## create the manifest
ffmpeg -f webm_dash_manifest -live 1 -i ${SERVER_DASH}/${CHUNK_VIDEO_NAME}.hdr -f webm_dash_manifest
 -live 1 -i ${SERVER_DASH}/${CHUNK_AUDIO_NAME}.hdr -c copy -map 0 -map 1 -f webm_dash_manifest -live
 1 -adaptation_sets "id=0,streams=0 id=1,streams=1" -chunk_start_index ${CHUNK_START_IDX} -chunk_dur
ation_ms 2000 -time_shift_buffer_depth 7200 -minimum_update_period 7200  ${SERVER_DASH}/${VIDEO_NAME
}_manifest.mpd

## HLS (apple iphone <video> frendly)
ffmpeg -f v4l2 -i /dev/video0 -f alsa  -thread_queue_size 1024 -i plughw:CARD=HD3000,DEV=0  -codec:v
 libx264 -crf 18 -profile:v high -level 4.2 -pix_fmt yuv420p  -codec:a aac -b:a 128k -strict experim
ental -f ssegment -segment_list $SERVER_HLS/playlist.m3u8 -segment_list_flags +live -segment_time 5
$SERVER_HLS/out%03d.ts
