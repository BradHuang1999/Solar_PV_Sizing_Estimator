import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class ApicallsService {

  constructor(private http: HttpClient) { }

  postData(requrestBody: any): Observable<any> {
    const url = "http://localhost:8000";

    return this.http.post(url, requrestBody);
  }
}
