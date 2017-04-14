# relaystream - using relay service, to run on-premises encoding




# LifeCam HD-3000
# 720p HD

# audo device
# > arecord -L
# plughw:CARD=HD3000,DEV=0
#   Microsoft® LifeCam HD-3000, USB Audio
#   Hardware device with all software conversions

# vid device /dev/video0
# > lsusb
# > lsusb -s 001:009 -v




# list formats supported by device
avconv -f v4l2 -list_formats all -i /dev/video0

# libx264 - the open source equivalent of h264, possibly the most popular video codec around
# -crf is quality 0 is lossless, 23 is default, and 51 is total rubbish, 18 being "visually lossless
".
# aac - audio is experimental - so need -strict
# 128k, 256k, and 320k are considered low, medium, and high quality respectively

#sound only
avconv -f alsa -i plughw:CARD=HD3000,DEV=0 -b:a 128k -strict -2 -y /tmp/ssd/sound.mp3
#video only (JMPEG -> MPEG-4)
avconv -f video4linux2 -input_format mjpeg -i  /dev/video0 -c:v libx264 -crf 23-y /tmp/ssd/video.m4v

avconv -f alsa -i plughw:CARD=HD3000,DEV=0 -c:a aac  -f video4linux2 -input_format mjpeg -i  /dev/vi
deo0 -c:v libx264 -crf 23 -b:a 128k -strict -2 -y /tmp/ssd/desk.mp4

# https://github.com/phoboslab/jsmpeg
#only supports
avconv -f alsa -thread_queue_size 1024 -i plughw:CARD=HD3000,DEV=0  -f v4l2  -i /dev/video0 -f mpegt
s  -codec:v mpeg1video -codec:a mp2 -bf 0     http://nuc6:8081/bob


# this works OK
avconv -f v4l2  -thread_queue_size 1024 -framerate 29.97  -i /dev/video0 -f alsa -thread_queue_size
1024 -i plughw:CARD=HD3000,DEV=0  -preset slow -f mpegts -codec:v mpeg1video -codec:a mp2 http://www
2mixlab.azurewebsites.net/bob
