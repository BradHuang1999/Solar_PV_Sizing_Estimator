import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class ApicallsService {

  constructor(private http: HttpClient) { }

  getPVSize(pvParams: any): Observable<any> {
    return this.http.post(environment.apiURL, pvParams);
  }

  getLocationFromIP(): Observable<any> {
    let ipParams = environment.production ? {} : { ip: '209.141.148.174' };

    return this.http.get(environment.apiURL + "/getLocationFromIP", {
      params: ipParams
    });
  }

  getLocationFromAddress(address: string): Observable<any> {
    return this.http.get(environment.apiURL + "/getLocationFromAddress", {
      params: { address: address }
    });
  }
}
