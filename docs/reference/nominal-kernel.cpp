// Extracted arithmetic diagnostic, not the original game or a gameplay run.
#include <iostream>
#include <iomanip>
#include <cmath>
int main() {
  const float dt=1.f/60.f;
  float speed=0.f, accel=100.f/6.5f;
  int gear=0, position=0, firstHigh=0;
  long long score=0;
  std::cout<<std::setprecision(9)<<"{\"kind\":\"extracted-arithmetic-diagnostic\",\"dt\":"<<dt<<",\"samples\":[";
  bool comma=false;
  for(int tick=1;tick<=781;++tick) {
    float cap=(gear==1)?200.f:100.f;
    speed += accel*dt;
    if(speed>cap) speed=cap;
    if(speed==cap&&gear==0) {gear=1;firstHigh=tick;}
    position=position+speed;
    if(speed>5.f) score += (int)((10.f+950.f*((speed-5.f)/141.f))/3.7f)*2.3f;
    if(tick==1||tick==60||tick==120||tick==390||tick==391||tick==780||tick==781) {
      if(comma)std::cout<<",";comma=true;
      std::cout<<"{\"tick\":"<<tick<<",\"speed\":"<<speed<<",\"gear\":"<<gear<<",\"distanceInt\":"<<position<<",\"sourceFloatScore\":"<<score<<"}";
    }
  }
  std::cout<<"],\"firstHighGearTick\":"<<firstHigh<<",\"laneGap\":{\"three\":0,\"four\":"<<((1600*16/27)+(1600/18))<<",\"eight\":"<<(5*((1600*16/27)+(1600/18)))<<",\"two\":"<<(5*((1600*16/27)+(1600/18))+(1600*16/27)*20+(1600/18)*7)<<"}}\n";
}
