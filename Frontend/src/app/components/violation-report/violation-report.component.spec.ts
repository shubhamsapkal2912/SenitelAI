import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViolationReportComponent } from './violation-report.component';

describe('ViolationReportComponent', () => {
  let component: ViolationReportComponent;
  let fixture: ComponentFixture<ViolationReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViolationReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViolationReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
