import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViolationDetailComponent } from './violation-detail.component';

describe('ViolationDetailComponent', () => {
  let component: ViolationDetailComponent;
  let fixture: ComponentFixture<ViolationDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViolationDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViolationDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
